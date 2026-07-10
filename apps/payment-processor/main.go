package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	ginprometheus "github.com/zsais/go-gin-prometheus"
	_ "kong-gateway/payment-processor/docs"
)

// PaymentRequest represents the incoming JSON payload for a payment
type PaymentRequest struct {
	UserID int     `json:"user_id" binding:"required"`
	Amount float64 `json:"amount" binding:"required"`
}

// PaymentEvent represents the message published to RabbitMQ
type PaymentEvent struct {
	PaymentID int     `json:"payment_id"`
	UserID    int     `json:"user_id"`
	Amount    float64 `json:"amount"`
	Status    string  `json:"status"`
}

// @title Payment Processor API
// @version 1.0
// @description API for processing payments
// @host localhost:8000
// @BasePath /

// createPayment is a dummy function just for swag documentation
// @Summary Process a new payment
// @Description Creates a payment in processing state and emits an event
// @Accept json
// @Produce json
// @Param request body PaymentRequest true "Payment Details"
// @Success 201 {object} map[string]interface{}
// @Router /payments [post]
func createPayment() {}

func main() {
	// 1. Connect to PostgreSQL
	// We read the DATABASE_URL environment variable to establish a connection.
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Use a default for local development if not provided
		dbURL = "postgres://postgres:postgres@localhost:5432/kong_payments?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}
	defer db.Close()

	// Verify database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Successfully connected to PostgreSQL")

	// Ensure the payments table exists
	createTableQuery := `
	CREATE TABLE IF NOT EXISTS payments (
		id SERIAL PRIMARY KEY,
		user_id INT NOT NULL,
		amount DECIMAL(10, 2) NOT NULL,
		status VARCHAR(50) NOT NULL
	);`
	if _, err := db.Exec(createTableQuery); err != nil {
		log.Fatalf("Failed to create payments table: %v", err)
	}

	createOutboxTableQuery := `
	CREATE TABLE IF NOT EXISTS outbox_events (
		id SERIAL PRIMARY KEY,
		event_type VARCHAR(50) NOT NULL,
		payload JSONB NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(createOutboxTableQuery); err != nil {
		log.Fatalf("Failed to create outbox_events table: %v", err)
	}

	// 2. Connect to RabbitMQ
	// We read the RABBITMQ_URL environment variable.
	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		rabbitURL = "amqp://guest:guest@localhost:5672/"
	}

	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()
	log.Println("Successfully connected to RabbitMQ")

	// Create a channel, which is where most of the API for getting things done resides
	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open a channel: %v", err)
	}
	defer ch.Close()

	// Declare a queue so that we can publish to it.
	// We declare it as durable so messages are safe if RabbitMQ restarts.
	queueName := "payment_completed_queue"
	q, err := ch.QueueDeclare(
		queueName,
		true,  // durable
		false, // delete when unused
		false, // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		log.Fatalf("Failed to declare a queue: %v", err)
	}

	// 3. Set up the Gin web server
	router := gin.Default()

	// Initialize Prometheus metrics middleware
	p := ginprometheus.NewPrometheus("gin")
	p.Use(router)

	// POST /payments endpoint to process a new payment

	router.POST("/payments", func(c *gin.Context) {
		var req PaymentRequest

		// Bind the incoming JSON to the PaymentRequest struct
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		// Deduct balance from user-service
		userServiceURL := fmt.Sprintf("http://user-service:3000/users/%d/deduct", req.UserID)
		deductReqBody, _ := json.Marshal(map[string]interface{}{"amount": req.Amount})
		resp, err := http.Post(userServiceURL, "application/json", bytes.NewBuffer(deductReqBody))
		if err != nil {
			log.Printf("Failed to contact user service: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to contact user service"})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			log.Printf("User service returned error: %s", string(bodyBytes))
			c.JSON(resp.StatusCode, gin.H{"error": "Failed to deduct funds", "details": string(bodyBytes)})
			return
		}

		// Save the payment to the database within a transaction
		tx, err := db.Begin()
		if err != nil {
			log.Printf("Failed to begin transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
			return
		}

		status := "processing"
		var paymentID int
		insertQuery := `INSERT INTO payments (user_id, amount, status) VALUES ($1, $2, $3) RETURNING id`
		err = tx.QueryRow(insertQuery, req.UserID, req.Amount, status).Scan(&paymentID)
		if err != nil {
			tx.Rollback()
			log.Printf("Failed to insert payment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save payment"})
			return
		}
		
		// Update event with actual payment ID before saving to outbox
		event := PaymentEvent{
			PaymentID: paymentID,
			UserID:    req.UserID,
			Amount:    req.Amount,
			Status:    status,
		}
		body, _ := json.Marshal(event)

		// Insert the event into the outbox table as part of the same transaction
		outboxQuery := `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2)`
		if _, err = tx.Exec(outboxQuery, "PaymentCompleted", body); err != nil {
			tx.Rollback()
			log.Printf("Failed to insert into outbox: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enqueue payment event"})
			return
		}

		if err = tx.Commit(); err != nil {
			log.Printf("Failed to commit transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize payment"})
			return
		}

		log.Printf("Saved payment and outbox event with Payment ID: %d", paymentID)

		// Return success response to the client
		c.JSON(http.StatusCreated, gin.H{
			"message": "Payment processing started",
			"payment": event,
		})
	})

	// Start the outbox processor in a background goroutine
	go processOutbox(db, ch, q.Name)

	// Swagger documentation route
	router.GET("/docs/payments/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))



	// Start the web server on port 3001
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	
	log.Printf("Starting payment-processor on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

// processOutbox periodically polls the outbox_events table and publishes to RabbitMQ
func processOutbox(db *sql.DB, ch *amqp.Channel, queueName string) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Fetch unpublished events
		rows, err := db.Query(`SELECT id, event_type, payload FROM outbox_events ORDER BY id ASC LIMIT 50`)
		if err != nil {
			log.Printf("Outbox query error: %v", err)
			continue
		}

		var eventIDs []int
		for rows.Next() {
			var id int
			var eventType string
			var payload []byte
			if err := rows.Scan(&id, &eventType, &payload); err != nil {
				log.Printf("Outbox row scan error: %v", err)
				continue
			}

			// Publish to RabbitMQ
			err = ch.PublishWithContext(
				context.Background(),
				"",        // exchange
				queueName, // routing key
				false,     // mandatory
				false,     // immediate
				amqp.Publishing{
					DeliveryMode: amqp.Persistent,
					ContentType:  "application/json",
					Body:         payload,
				})

			if err != nil {
				log.Printf("Failed to publish outbox event ID %d: %v", id, err)
				continue
			}

			eventIDs = append(eventIDs, id)
			log.Printf("Successfully published outbox event ID %d", id)
		}
		rows.Close()

		// Delete published events
		if len(eventIDs) > 0 {
			// Construct a query to delete all processed IDs
			// For simplicity we loop, but in production use an IN clause or bulk delete
			for _, id := range eventIDs {
				_, err := db.Exec(`DELETE FROM outbox_events WHERE id = $1`, id)
				if err != nil {
					log.Printf("Failed to delete outbox event ID %d: %v", id, err)
				}
			}
		}
	}
}
