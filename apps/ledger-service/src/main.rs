use axum::{extract::State, routing::get, Json, Router};
use chrono::{DateTime, Utc};
use futures::StreamExt; // Trait for iterating over AMQP consumers
use lapin::{
    options::*, types::FieldTable, Connection, ConnectionProperties,
};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::Arc;
use uuid::Uuid;

/// The shared application state that Axum will pass to our route handlers.
#[derive(Clone)]
struct AppState {
    db: PgPool, // SQLx connection pool
}

/// A struct representing a ledger entry in our PostgreSQL database.
/// `sqlx::FromRow` allows automatic mapping from SQL query results.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
struct LedgerEntry {
    id: Uuid,
    payment_id: String,
    amount: i64,
    currency: String,
    status: String,
    created_at: DateTime<Utc>,
}

/// The expected payload from RabbitMQ when a payment is completed.
#[derive(Debug, Deserialize)]
struct PaymentMessage {
    payment_id: String,
    amount: i64,
    currency: String,
}

#[tokio::main]
async fn main() {
    // 1. Initialize logging (tracing)
    // This allows us to see INFO/ERROR logs in the console.
    tracing_subscriber::fmt::init();
    tracing::info!("Starting Ledger Service...");

    // 2. Read configuration from environment variables (or use defaults for local dev)
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/postgres".to_string());
    let rabbitmq_url = std::env::var("RABBITMQ_URL")
        .unwrap_or_else(|_| "amqp://guest:guest@localhost:5672/%2f".to_string());

    // 3. Connect to PostgreSQL via connection pool
    let db_pool = PgPoolOptions::new()
        .max_connections(5) // Limit maximum concurrent DB connections
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    // 4. Ensure our `ledger` table exists
    // Since this is a learning/toy project, we just create the table at startup
    // rather than using a complex migration tool.
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS ledger (
            id UUID PRIMARY KEY,
            payment_id VARCHAR NOT NULL,
            amount BIGINT NOT NULL,
            currency VARCHAR NOT NULL,
            status VARCHAR NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
        );
        "#
    )
    .execute(&db_pool)
    .await
    .expect("Failed to create ledger table");
    tracing::info!("Ledger table ensured.");

    // 5. Connect to RabbitMQ
    let amqp_conn = Connection::connect(&rabbitmq_url, ConnectionProperties::default())
        .await
        .expect("Failed to connect to RabbitMQ");

    // 6. Start the RabbitMQ consumer in a background task
    // We clone the DB pool so the background task can insert records.
    let db_for_background = db_pool.clone();
    tokio::spawn(async move {
        consume_messages(amqp_conn, db_for_background).await;
    });

    // 7. Configure Axum Router
    let state = AppState { db: db_pool };
    let app = Router::new()
        // Define the route for listing ledger entries
        .route("/ledger", get(list_ledger))
        // Pass our AppState to the router
        .with_state(state);

    // 8. Bind the HTTP server to a port and start listening
    let port = 3002;
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tracing::info!("Ledger Service HTTP server listening on {}", addr);
    
    // Start serving HTTP traffic
    axum::serve(listener, app).await.unwrap();
}

/// This function runs infinitely in the background, reading from RabbitMQ
/// and saving new payments into the PostgreSQL database.
async fn consume_messages(conn: Connection, db: PgPool) {
    // Open a communication channel with RabbitMQ
    let channel = conn.create_channel().await.expect("Failed to create AMQP channel");

    // Declare the queue to ensure it exists before we try to consume from it.
    let mut options = QueueDeclareOptions::default();
    options.durable = true;
    channel.queue_declare(
        "payment_completed_queue",
        options,
        FieldTable::default(),
    ).await.expect("Failed to declare queue");

    // Create a consumer that listens to our queue
    let mut consumer = channel.basic_consume(
        "payment_completed_queue",
        "ledger_service_consumer", // A unique tag for this consumer
        BasicConsumeOptions::default(),
        FieldTable::default(),
    ).await.expect("Failed to create consumer");

    tracing::info!("Started consuming from 'payment_completed_queue'");

    // Process incoming messages one by one
    while let Some(delivery_result) = consumer.next().await {
        match delivery_result {
            Ok(delivery) => {
                // We successfully pulled a message from RabbitMQ
                // Try to parse the JSON payload into our `PaymentMessage` struct
                if let Ok(msg) = serde_json::from_slice::<PaymentMessage>(&delivery.data) {
                    tracing::info!("Received payment message: {:?}", msg);

                    let id = Uuid::new_v4(); // Generate a random UUID for the new ledger entry
                    let now = Utc::now();

                    // Insert into PostgreSQL
                    // We use `query` instead of `query!` to avoid requiring a live DB at compile time.
                    let result = sqlx::query(
                        "INSERT INTO ledger (id, payment_id, amount, currency, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)"
                    )
                    .bind(id)
                    .bind(msg.payment_id.clone())
                    .bind(msg.amount)
                    .bind(msg.currency.clone())
                    .bind("COMPLETED") // Mark the ledger status as completed
                    .bind(now)
                    .execute(&db)
                    .await;

                    match result {
                        Ok(_) => {
                            // If the insert was successful, acknowledge (ACK) the message
                            // so RabbitMQ removes it from the queue.
                            if let Err(e) = delivery.ack(BasicAckOptions::default()).await {
                                tracing::error!("Failed to ACK message: {}", e);
                            } else {
                                tracing::info!("Successfully recorded ledger entry for payment {}", msg.payment_id);
                            }
                        }
                        Err(e) => {
                            // If DB insertion fails, we NACK the message so it can be retried later.
                            tracing::error!("Database insert failed: {}", e);
                            let _ = delivery.nack(BasicNackOptions::default()).await;
                        }
                    }
                } else {
                    // The message was not valid JSON or didn't match our schema.
                    // We reject it completely so it doesn't get stuck in a retry loop.
                    tracing::error!("Failed to parse message payload. Rejecting message.");
                    let _ = delivery.reject(BasicRejectOptions::default()).await;
                }
            }
            Err(e) => {
                tracing::error!("Error receiving message from RabbitMQ: {}", e);
            }
        }
    }
}

/// Handler for `GET /ledger`.
/// Returns all ledger entries in JSON format, ordered by newest first.
async fn list_ledger(State(state): State<AppState>) -> Json<Vec<LedgerEntry>> {
    // Query the database for all ledger entries
    let entries = sqlx::query_as::<_, LedgerEntry>("SELECT * FROM ledger ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("Failed to fetch ledger entries: {}", e);
            vec![] // Return empty array on error for simplicity
        });

    // Send the entries back as a JSON response
    Json(entries)
}
