package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"
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

	// POST /payments endpoint to process a new payment
	router.POST("/payments", func(c *gin.Context) {
		var req PaymentRequest

		// Bind the incoming JSON to the PaymentRequest struct
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		// Save the payment to the database with a 'processing' status
		status := "processing"
		var paymentID int
		insertQuery := `INSERT INTO payments (user_id, amount, status) VALUES ($1, $2, $3) RETURNING id`
		err := db.QueryRow(insertQuery, req.UserID, req.Amount, status).Scan(&paymentID)
		if err != nil {
			log.Printf("Failed to insert payment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save payment"})
			return
		}

		log.Printf("Saved payment with ID: %d", paymentID)

		// Create the payment event to publish
		event := PaymentEvent{
			PaymentID: paymentID,
			UserID:    req.UserID,
			Amount:    req.Amount,
			Status:    status,
		}

		// Serialize the event to JSON
		body, err := json.Marshal(event)
		if err != nil {
			log.Printf("Failed to marshal event to JSON: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process payment event"})
			return
		}

		// Publish the message to RabbitMQ
		err = ch.PublishWithContext(
			context.Background(),
			"",     // exchange
			q.Name, // routing key
			false,  // mandatory
			false,  // immediate
			amqp.Publishing{
				DeliveryMode: amqp.Persistent,
				ContentType:  "application/json",
				Body:         body,
			})
		if err != nil {
			log.Printf("Failed to publish a message: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enqueue payment event"})
			return
		}

		log.Printf("Published payment event for ID: %d to queue: %s", paymentID, q.Name)

		// Return success response to the client
		c.JSON(http.StatusCreated, gin.H{
			"message": "Payment processing started",
			"payment": event,
		})
	})

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
