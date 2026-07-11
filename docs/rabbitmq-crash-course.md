# RabbitMQ Crash Course

## What is RabbitMQ?
RabbitMQ is a widely deployed open-source message broker. It accepts and forwards messages, acting essentially as a post office for your applications.

## Key Concepts
- **Producer**: A program that sends messages.
- **Queue**: A buffer that stores messages. It is essentially a large message box.
- **Consumer**: A program that waits to receive messages from a queue.
- **Exchange**: Producers don't send messages directly to queues. They send them to an exchange, which uses rules (bindings) to route messages to zero or more queues.
- **Binding**: A link between a queue and an exchange.

## Why use a Message Broker?
- **Decoupling**: Services don't need to know about each other. A service can emit an event, and it doesn't care who processes it.
- **Resilience**: If a consuming service is down, the broker holds the message until the service comes back online.
- **Asynchronous Processing**: Fire-and-forget logic (e.g., initiating a background task) speeds up API response times.

## RabbitMQ in this Project
We use RabbitMQ for inter-service communication. For example, when a user is created in the `user-service`, it publishes an event. More importantly, when the `payment-processor` processes a payment, it publishes the payment details to a `payment_completed_queue`. The `ledger-service` listens to this queue and persistently logs the payment asynchronously.
