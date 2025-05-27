.PHONY: build run push clean help dev install lint typecheck test logs docker-dev docker-up docker-down

# Project configuration
IMAGE_NAME := tentix
VERSION := $(shell date +%Y%m%d)-$(shell git rev-parse --short HEAD 2>/dev/null || echo "dev")
DOCKER_REGISTRY := crpi-visd77fbydeujidg.cn-hangzhou.personal.cr.aliyuncs.com
CONTAINER_NAME := tentix-container
PORT := 3000

help:
	@echo "Available targets:"
	@echo "  dev          - Start development server locally"
	@echo "  docker-dev   - Start development server in Docker"
	@echo "  docker-up    - Start production containers"
	@echo "  docker-down  - Stop all containers"
	@echo "  build        - Build Docker image"
	@echo "  run          - Run container locally"
	@echo "  stop         - Stop running container"
	@echo "  logs         - Show container logs"
	@echo "  push         - Push image to registry"
	@echo "  clean        - Remove Docker image and container"
	@echo "  lint         - Run linting"
	@echo "  test         - Run tests"
	@echo "  format       - Format code"
	@echo "  help         - Show this help message"


dev:
	@echo "Starting development server..."
	bun run dev

lint:
	@echo "Running linting..."
	bun run lint


test:
	@echo "Running tests..."
	bun run test

format:
	@echo "Formatting code..."
	bun run format

build:
	@echo "Building Docker image: $(IMAGE_NAME):$(VERSION)"
	docker build --platform linux/amd64 -t $(IMAGE_NAME):$(VERSION) . --no-cache
	docker tag $(IMAGE_NAME):$(VERSION) $(IMAGE_NAME):latest

run:
	@echo "Stopping existing container if running..."
	-docker stop $(CONTAINER_NAME) 2>/dev/null || true
	-docker rm $(CONTAINER_NAME) 2>/dev/null || true
	@echo "Running container: $(CONTAINER_NAME)"
	docker run -d --name $(CONTAINER_NAME) -p $(PORT):3000 $(IMAGE_NAME):$(VERSION)
	@echo "Container is running at http://localhost:$(PORT)"

stop:
	@echo "Stopping container: $(CONTAINER_NAME)"
	-docker stop $(CONTAINER_NAME)
	-docker rm $(CONTAINER_NAME)

logs:
	@echo "Showing logs for container: $(CONTAINER_NAME)"
	docker logs -f $(CONTAINER_NAME)

# Docker Compose commands
docker-dev:
	@echo "Starting development environment with Docker Compose..."
	docker-compose --profile dev up --build

docker-up:
	@echo "Starting production environment with Docker Compose..."
	docker-compose up -d --build

docker-down:
	@echo "Stopping all Docker Compose services..."
	docker-compose down

docker-logs:
	@echo "Showing Docker Compose logs..."
	docker-compose logs -f

push:
ifdef DOCKER_REGISTRY
	@echo "Tagging and pushing image to registry..."
	docker tag $(IMAGE_NAME):$(VERSION) $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION)
	docker tag $(IMAGE_NAME):$(VERSION) $(DOCKER_REGISTRY)/$(IMAGE_NAME):latest
	docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION)
	docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):latest
	@echo "Image pushed successfully!"
else
	@echo "Error: DOCKER_REGISTRY is not set. Use: make push DOCKER_REGISTRY=your-registry"
	@exit 1
endif

clean:
	@echo "Cleaning up Docker resources..."
	-docker stop $(CONTAINER_NAME) 2>/dev/null || true
	-docker rm $(CONTAINER_NAME) 2>/dev/null || true
	-docker rmi $(IMAGE_NAME):$(VERSION) 2>/dev/null || true
	-docker rmi $(IMAGE_NAME):latest 2>/dev/null || true
	@echo "Cleanup completed!"

# Development workflow
dev-build: 
	docker build --no-cache .

# Production workflow
prod-deploy: build push

# Default target
.DEFAULT_GOAL := help 