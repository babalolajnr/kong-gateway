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
        
        Kong -- Rate Limiting & Key Auth --> Kong
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

    %% Routing logic
    Client -- "POST /users\nGET /users" --> Kong
    Client -- "POST /payments" --> Kong
    Client -- "GET /ledger" --> Kong
    
    Admin -- "Manage Routes/Plugins" --> Manager

    Kong -- "/users" --> UserService
    Kong -- "/payments" --> PaymentProcessor
    Kong -- "/ledger" --> LedgerService

    %% Service to DB connections
    UserService --> UsersDB
    PaymentProcessor --> PaymentsDB
    LedgerService --> LedgerDB

    %% Service to RabbitMQ connections
    UserService -- "Publish 'user_events'" --> RabbitMQ
    PaymentProcessor -- "Publish 'payment_completed_queue'" --> RabbitMQ
    RabbitMQ -- "Consume 'payment_completed_queue'" --> LedgerService

    classDef default fill:#2b2b2b,stroke:#555,stroke-width:1px,color:#eee;
    classDef gateway fill:#003366,stroke:#0055a4,stroke-width:2px,color:#fff;
    classDef service fill:#005500,stroke:#00aa00,stroke-width:2px,color:#fff;
    classDef db fill:#660000,stroke:#aa0000,stroke-width:2px,color:#fff;
    classDef queue fill:#884400,stroke:#ff8800,stroke-width:2px,color:#fff;

    class Kong,Manager gateway;
    class UserService,PaymentProcessor,LedgerService service;
    class UsersDB,PaymentsDB,LedgerDB db;
    class RabbitMQ queue;
```

## Description

1. **Kong Gateway**: Acts as the single entry point for all external client traffic. It enforces cross-cutting concerns like Rate Limiting and Key Authentication. Kong Manager provides a GUI for configuring these policies.
2. **User Service**: A TypeScript/Fastify microservice that handles user registration. It saves users to the `users_db` and publishes events to RabbitMQ.
3. **Payment Processor**: A Go/Gin microservice that receives payment requests. It writes the initial "processing" state to the `payments_db` and publishes the payment details to the `payment_completed_queue` in RabbitMQ.
4. **Ledger Service**: A Rust/Axum microservice that listens to the `payment_completed_queue`. When a payment is processed, it consumes the event and records it permanently in the `ledger_db` as "COMPLETED". It also exposes a `/ledger` endpoint to list all transactions. 
5. **Data Isolation**: Each microservice maintains its own independent PostgreSQL database instance (`users_db`, `payments_db`, `ledger_db`), adhering to the database-per-service pattern.
