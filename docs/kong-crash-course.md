# Kong API Gateway Crash Course

## What is Kong?
Kong is an open-source API Gateway and Microservices Management Layer, optimized for high performance and reliability. It sits in front of your upstream APIs and routes client requests to them.

## DB-less vs Database Mode
- **Database Mode**: Kong connects to a database (PostgreSQL or Cassandra) to store its configuration. Changes can be made dynamically via the Admin API.
- **DB-less Mode (Declarative)**: Kong stores its configuration entirely in memory, loaded from a declarative YAML or JSON file. This is ideal for CI/CD pipelines and Kubernetes ConfigMaps. We use this mode in our project.

## Key Concepts
- **Service**: An abstraction of an upstream API or microservice.
- **Route**: Defines rules to match client requests. Each Route is associated with a Service. If a request matches a Route, it is proxied to the underlying Service.
- **Plugins**: Add functionality to APIs (e.g., rate-limiting, authentication, logging). Plugins can be applied globally, or specific to a Route or Service.

## Declarative Config Example (`kong.yml`)
```yaml
_format_version: "3.0"
services:
  - name: user-service
    url: http://user-service:3000
    routes:
      - name: user-route
        paths:
          - /users
plugins:
  - name: key-auth # Applies globally
  - name: rate-limiting
    config:
      minute: 20
```

## Kong in this Project
We run Kong as the single entry point for our system. It handles rate-limiting and API key authentication before forwarding requests to the appropriate internal backend (`user-service`, `payment-processor`, or `ledger-service`).
