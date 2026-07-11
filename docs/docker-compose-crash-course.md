# Docker Compose Crash Course

## What is Docker Compose?
Docker Compose is a tool for defining and running multi-container Docker applications. With Compose, you use a YAML file to configure your application's services, networks, and volumes.

## Key Concepts
- **Services**: The different containers that make up your application (e.g., a web server, a database, a message broker).
- **Networks**: Communication channels between containers. By default, Compose sets up a single network for your app, and each service is reachable by other services at a hostname identical to the service name.
- **Volumes**: Persistent data storage. When a container is deleted, its data is lost unless it is stored in a volume mapped to the host machine.

## Essential Commands
- `docker compose up`: Build, (re)create, start, and attach to containers for a service.
- `docker compose up -d`: Run containers in the background (detached mode).
- `docker compose up --build`: Force rebuild of custom images before starting.
- `docker compose down`: Stop and remove containers, networks, images, and volumes.
- `docker compose logs -f`: Follow log output from services.

## Docker Compose in this Project
Before moving to Kubernetes, we utilized a `docker-compose.yml` file to stitch our infrastructure together. It automatically provisions Kong, Postgres, RabbitMQ, and builds the Docker images for our polyglot microservices, connecting them all over a shared bridge network.
