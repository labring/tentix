.PHONY: build run push clean help

IMAGE_NAME := tentix
VERSION := 
DOCKER_REGISTRY := 

help:
	@echo "Available targets:"
	@echo "  build      - Build Docker image"
	@echo "  run        - Run container locally"
	@echo "  push       - Push image to registry"
	@echo "  clean      - Remove Docker image"
	@echo "  help       - Show this help message"

build:
	docker build --platform linux/amd64 -t $(IMAGE_NAME):$(VERSION) . --no-cache

run:
	docker run -p 3000:3000 $(IMAGE_NAME):$(VERSION)

push:
ifdef DOCKER_REGISTRY
	docker tag $(IMAGE_NAME):$(VERSION) $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION)
	docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION)
else
	@echo "Error: DOCKER_REGISTRY is not set. Use: make push DOCKER_REGISTRY=your-registry"
	@exit 1
endif

clean:
	docker rmi $(IMAGE_NAME):$(VERSION)

# Default target
.DEFAULT_GOAL := help 