# Stage 1: Build the Rust binary
FROM rust:slim AS builder

WORKDIR /usr/src/ledger-service

# Copy the Cargo.toml
COPY Cargo.toml ./

# Create a dummy src/main.rs to build dependencies and cache them
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Now copy the actual source code
COPY src ./src

# Touch main.rs to ensure cargo knows it was updated
RUN touch src/main.rs
RUN cargo build --release

# Stage 2: Create the runtime image
FROM debian:bookworm-slim

# Install CA certificates (required for secure network requests if any)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /usr/src/ledger-service/target/release/ledger-service /app/ledger-service

# Expose the Axum server port
EXPOSE 3002

# Set the binary as the entrypoint
ENTRYPOINT ["/app/ledger-service"]
