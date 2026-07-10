# Stage 1: Build the Go binary
# We use the official Golang image as our build environment
FROM golang:alpine AS builder

# Set the current working directory inside the container
WORKDIR /app

# Copy the go.mod and go.sum files first to leverage Docker cache
# This allows Docker to cache the downloaded dependencies if these files haven't changed
COPY go.mod go.sum ./

# Download all dependencies. 
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the Go application
# CGO_ENABLED=0 creates a statically linked binary which is required for running in scratch/alpine without cgo dependencies
# GOOS=linux targets the linux operating system
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o payment-processor .

# Stage 2: Create a lightweight runtime image
# We use a minimal alpine image to keep the final container size small
FROM alpine:latest

# Add ca-certificates in case we need to make secure external HTTPS calls
RUN apk --no-cache add ca-certificates

# Set the working directory in the final image
WORKDIR /root/

# Copy the pre-built binary file from the builder stage
COPY --from=builder /app/payment-processor .

# Expose port 3001 to the outside world
EXPOSE 3001

# Command to run the executable when the container starts
CMD ["./payment-processor"]
