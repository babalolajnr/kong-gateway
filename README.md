# Toy Payment Gateway (Kong Microservices Demo)

A toy payment gateway system built in a monorepo setup to demonstrate an event-driven microservices architecture fronted by the **Kong API Gateway**.

## Architecture Overview

The project uses **Kong** in DB-less mode to route traffic, enforce rate limiting, and apply JWT authentication. Behind the gateway, three independent microservices—each with its own isolated PostgreSQL database—handle the domain logic. They communicate asynchronously via **RabbitMQ** and expose OpenAPI documentation.

For a detailed visual breakdown, check out the [Architecture Diagram](./architecture.md).

## Tech Stack

*   **API Gateway**: Kong (DB-less) + Kong Manager
*   **Message Broker**: RabbitMQ
*   **Database**: PostgreSQL 16 (3 isolated databases)
*   **Observability**: Prometheus & Grafana
*   **Monorepo Tooling**: Nx
*   **Microservices**:
    *   **User Service**: Node.js, TypeScript, Fastify (Auth, Wallets)
    *   **Payment Processor**: Go, Gin (Transactional Outbox)
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

2.  **Choose your environment**:

    **Option A: Local Development (Hot-Reloading with Docker Compose)**
    Use this for writing code. The `docker-compose.override.yml` maps your source code into the containers and automatically recompiles when you save files.
    ```bash
    make dev-all
    ```
    This spins up Kong, PostgreSQL, RabbitMQ, and the microservices with hot-reloading enabled.

    **Option B: Production Simulation (Minikube & Helm)**
    Use this to test the exact deployment manifests that run in production. This builds the images inside the cluster and deploys them using Helm.
    ```bash
    make k8s-deploy
    ```

3.  **Access Dashboards & Docs**:
    *   **Kong Manager**: `http://localhost:8002`
    *   **Prometheus**: `http://localhost:9090`
    *   **Grafana**: `http://localhost:3000` (Login: admin / admin)
    *   **Swagger API Docs**: `http://localhost:8000/docs/users`, `/docs/payments`, and `/docs/ledger`

## Testing the API

Kong listens on port `8000` for client traffic. Authentication is handled via **JWT**. 

### 1. Register and Login
First, create a user and log in to get a token:
```bash
# Register
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "password123"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "password123"}' | jq -r .token)
```

### 2. Fund Wallet
Add money to the user's wallet:
```bash
curl -X POST http://localhost:8000/users/1/fund \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500.00}'
```

### 3. Process a Payment
```bash
curl -X POST http://localhost:8000/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "amount": 150.50}'
```
*This internally deducts the balance from the `user-service`, saves a "processing" payment in `payments_db` alongside an outbox event, and a background worker publishes it to RabbitMQ.*

### 4. Check the Ledger
```bash
curl -X GET http://localhost:8000/ledger \
  -H "Authorization: Bearer $TOKEN"
```
*The `ledger-service` automatically consumes the RabbitMQ event in the background and saves the completed transaction to the `ledger_db`.*

## CI/CD and Production Workflow

This repository is configured to demonstrate a realistic **Dev-to-Prod** pipeline:

1. **Local Development**: Developers use `make dev-all` (Docker Compose) for instant feedback and hot-reloading while writing code.
2. **Continuous Integration**: When code is pushed to `master`, a GitHub Actions pipeline (`.github/workflows/ci-cd.yaml`) automatically runs. It uses **Nx** to build all affected projects and builds their multi-stage Docker images.
3. **Continuous Deployment**: The pipeline tags the new Docker images and deploys the `kong-stack` Helm chart to the Kubernetes cluster, performing a zero-downtime rolling update.
