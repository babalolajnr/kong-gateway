# Toy Payment Gateway (Kong Microservices Demo)

A toy payment gateway system built in a monorepo setup to demonstrate an event-driven microservices architecture fronted by the **Kong API Gateway**.

## Architecture Overview

The project uses **Kong** in DB-less mode to route traffic, enforce rate limiting, and apply key authentication. Behind the gateway, three independent microservices—each with its own isolated PostgreSQL database—handle the domain logic. They communicate asynchronously via **RabbitMQ**.

For a detailed visual breakdown, check out the [Architecture Diagram](./architecture.md).

## Tech Stack

*   **API Gateway**: Kong (DB-less) + Kong Manager
*   **Message Broker**: RabbitMQ
*   **Database**: PostgreSQL 16 (3 isolated databases)
*   **Monorepo Tooling**: Nx
*   **Microservices**:
    *   **User Service**: Node.js, TypeScript, Fastify
    *   **Payment Processor**: Go, Gin
    *   **Ledger Service**: Rust, Axum

## Prerequisites

*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone https://github.com/babalolajnr/kong-gateway.git
    cd kong-gateway
    ```

2.  **Spin up the infrastructure and services**:
    ```bash
    docker compose up -d --build
    ```
    This will build the Docker images for the three microservices and spin up Kong, PostgreSQL, and RabbitMQ. Wait a few moments for the databases and message broker to become healthy.

3.  **Access Kong Manager (Dashboard)**:
    Open your browser and navigate to `http://localhost:8002` to visually inspect the routes and plugins configured in the gateway.

## Testing the API

Kong listens on port `8000` for client traffic. We have a pre-configured consumer with the API key: `test-api-key`.

### 1. Create a User
```bash
curl -X POST http://localhost:8000/users \
  -H "apikey: test-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

### 2. Process a Payment
```bash
curl -X POST http://localhost:8000/payments \
  -H "apikey: test-api-key" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "amount": 150.50}'
```
*This will save a "processing" payment in the `payments_db` and publish an event to RabbitMQ.*

### 3. Check the Ledger
```bash
curl -X GET http://localhost:8000/ledger \
  -H "apikey: test-api-key"
```
*The `ledger-service` automatically consumes the RabbitMQ event in the background and saves the completed transaction to the `ledger_db`.*
