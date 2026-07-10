#!/bin/bash
set -e

echo "Starting Minikube (if not already running)..."
minikube start

echo "Configuring Docker to use Minikube's Docker daemon..."
eval $(minikube -p minikube docker-env --shell bash)

echo "Building user-service image..."
docker build -t kong-gateway-user-service ./apps/user-service

echo "Building payment-processor image..."
docker build -t kong-gateway-payment-processor ./apps/payment-processor

echo "Building ledger-service image..."
docker build -t kong-gateway-ledger-service ./apps/ledger-service

echo "Copying config files into Helm chart directory..."
mkdir -p helm/kong-stack/files
cp postgres-init.sh helm/kong-stack/files/
cp kong/kong.yml helm/kong-stack/files/
cp prometheus.yml helm/kong-stack/files/

echo "Deploying the Helm chart..."
helm upgrade --install kong-stack ./helm/kong-stack

echo "Deployment complete! Wait a few moments for the pods to become ready."
echo "You can check the status using: kubectl get pods"
echo "To access the API Gateway, use: minikube service kong --url"
