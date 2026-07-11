# Microservice Frameworks Crash Course

In this project, we built a polyglot backend system. Each microservice uses a completely different programming language and web framework to demonstrate modern API capabilities. Here's a brief crash course on each:

## 1. Fastify (TypeScript / Node.js) - `user-service`
Fastify is a fast and low overhead web framework for Node.js.

- **Why Fastify?** It's highly performant, provides a great developer experience, and has excellent TypeScript support.
- **Key Concepts**:
  - **Plugins**: Everything in Fastify is a plugin. You encapsulate routes and decorators into plugins to share context.
  - **Schema Validation**: Fastify has JSON Schema validation built-in (using Ajv under the hood), which compiles schemas into highly optimized JavaScript functions.
  - **Decorators**: You can attach custom properties to the Fastify instance (e.g., database connection pools) using `fastify.decorate()`.

## 2. Gin (Go) - `payment-processor`
Gin is a high-performance HTTP web framework written in Go (Golang). It features a Martini-like API but with performance up to 40 times faster.

- **Why Gin?** Go is excellent for concurrent tasks and network applications. Gin provides a fast router and convenient helpers for handling JSON, parameters, and middleware.
- **Key Concepts**:
  - **Router (`gin.Engine`)**: The core object `r := gin.Default()` handles HTTP requests and middleware.
  - **Context (`*gin.Context`)**: The most important part of Gin. It allows passing variables between middleware, manages the flow, validates JSON requests, and renders JSON responses.
  - **Goroutines**: Go's lightweight threads. We used Go channels and goroutines for concurrency when publishing to RabbitMQ.

## 3. Axum (Rust) - `ledger-service`
Axum is an ergonomic and modular web framework built with Tokio, Tower, and Hyper.

- **Why Axum?** Rust offers incredible performance and memory safety without a garbage collector. Axum integrates seamlessly with the Tokio async ecosystem.
- **Key Concepts**:
  - **Handlers**: Asynchronous functions that take extractors as arguments and return something that implements `IntoResponse`.
  - **Extractors**: Types that pull data out of the incoming request (e.g., `State`, `Json`, `Path`). If a request doesn't match an extractor, Axum automatically rejects it.
  - **State**: The `axum::extract::State` allows you to safely share data (like database connection pools and RabbitMQ channels) across all of your request handlers.
