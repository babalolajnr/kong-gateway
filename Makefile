.PHONY: help dev-infra dev-all k8s-deploy clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev-infra: ## Start infrastructure only (Kong, Postgres, RabbitMQ)
	docker compose up -d kong postgres rabbitmq prometheus grafana

dev-all: ## Start the entire stack with hot-reloading (via docker compose watch)
	docker compose up -d --build
	docker compose watch

k8s-deploy: ## Deploy the entire stack to local Minikube using Helm
	./deploy-k8s.sh

clean: ## Remove Docker Compose containers and volumes
	docker compose down -v
