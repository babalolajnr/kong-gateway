# System Architecture

Below is a detailed Mermaid diagram illustrating the architecture of our toy payment gateway system.

```mermaid
flowchart TD
    %% Define external actors
    Client((Client API/App))
    Admin((Admin/Developer))

    %% Define Kong API Gateway
    subgraph Gateway [Kong API Gateway Network]
        Kong[Kong API Gateway\n:8000]
        Manager[Kong Manager\n:8002]
        
        Kong -- Rate Limiting & JWT Auth --> Kong
    end

    %% Define message broker
    subgraph Broker [Message Broker]
        RabbitMQ[(RabbitMQ\n:5672)]
    end

    %% Define databases
    subgraph Databases [PostgreSQL Instance]
        UsersDB[(users_db)]
        PaymentsDB[(payments_db)]
        LedgerDB[(ledger_db)]
    end

    %% Define microservices
    subgraph Microservices [Backend Microservices]
        UserService[User Service\nTypeScript / Fastify\n:3000]
        PaymentProcessor[Payment Processor\nGo / Gin\n:3001]
        LedgerService[Ledger Service\nRust / Axum\n:3002]
    end

    %% Define Observability
    subgraph Observability [Monitoring & Metrics]
        Prometheus[(Prometheus\n:9090)]
        Grafana[Grafana\n:3000]
        
        Prometheus -- "Scrape /metrics" --> Kong
        Prometheus -- "Scrape /metrics" --> UserService
        Prometheus -- "Scrape /metrics" --> PaymentProcessor
        Prometheus -- "Scrape /metrics" --> LedgerService
        Grafana -- "Query" --> Prometheus
    end

    %% Routing logic
    Client -- "POST /users\nPOST /login\nPOST /users/:id/fund" --> Kong
    Client -- "POST /payments" --> Kong
    Client -- "GET /ledger" --> Kong
    Client -- "GET /docs/*" --> Kong
    
    Admin -- "Manage Routes/Plugins" --> Manager

    Kong -- "/users, /login" --> UserService
    Kong -- "/payments" --> PaymentProcessor
    Kong -- "/ledger" --> LedgerService

    %% Inter-service communication
    PaymentProcessor -- "HTTP POST /users/:id/deduct" --> UserService

    %% Service to DB connections
    UserService --> UsersDB
    PaymentProcessor --> PaymentsDB
    LedgerService --> LedgerDB

    %% Service to RabbitMQ connections
    PaymentProcessor -- "Publish 'payment_completed_queue'\n(Transactional Outbox)" --> RabbitMQ
    RabbitMQ -- "Consume 'payment_completed_queue'" --> LedgerService

    classDef default fill:#2b2b2b,stroke:#555,stroke-width:1px,color:#eee;
    classDef gateway fill:#003366,stroke:#0055a4,stroke-width:2px,color:#fff;
    classDef service fill:#005500,stroke:#00aa00,stroke-width:2px,color:#fff;
    classDef db fill:#660000,stroke:#aa0000,stroke-width:2px,color:#fff;
    classDef queue fill:#884400,stroke:#ff8800,stroke-width:2px,color:#fff;
    classDef monitor fill:#4b0082,stroke:#8a2be2,stroke-width:2px,color:#fff;

    class Kong,Manager gateway;
    class UserService,PaymentProcessor,LedgerService service;
    class UsersDB,PaymentsDB,LedgerDB db;
    class RabbitMQ queue;
    class Prometheus,Grafana monitor;
```

## Description

1. **Kong Gateway**: Acts as the single entry point for all external client traffic. It enforces cross-cutting concerns like Rate Limiting and JWT Authentication. Kong Manager provides a GUI for configuring these policies.
2. **User Service**: A TypeScript/Fastify microservice that handles user registration, JWT generation, and wallet balances. It saves users to the `users_db` and processes internal requests to deduct balances.
3. **Payment Processor**: A Go/Gin microservice that receives payment requests. It first verifies and deducts the user's wallet via an internal HTTP call to the User Service. Then, using the **Transactional Outbox pattern**, it saves a "processing" payment in the `payments_db` and an outbox event in the same atomic transaction. A background worker reliably publishes the outbox events to the `payment_completed_queue` in RabbitMQ.
4. **Ledger Service**: A Rust/Axum microservice that listens to the `payment_completed_queue`. When a payment is processed, it consumes the event and records it permanently in the `ledger_db` as "COMPLETED". It also exposes a `/ledger` endpoint to list all transactions. 
5. **Data Isolation**: Each microservice maintains its own independent PostgreSQL database instance (`users_db`, `payments_db`, `ledger_db`), adhering to the database-per-service pattern.
6. **Observability**: Prometheus continually scrapes `/metrics` endpoints across Kong and all backend services. Grafana uses Prometheus as a data source to visualize these metrics.
7. **API Documentation**: Each service auto-generates Swagger/OpenAPI documentation, accessible via the Kong Gateway at `/docs/users`, `/docs/payments`, and `/docs/ledger`.
