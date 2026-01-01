.PHONY: help install dev dev-preprocess start up down logs restart ps build health deploy setup certs clean

# Default to dev; override with IMGBOARD_ENV=prod
IMGBOARD_ENV ?= dev

ifeq ($(IMGBOARD_ENV),prod)
  COMPOSE_FILE := ./deploy/docker-compose.yml
  HEALTH_CMD := curl -sf -k https://localhost:3000/health
else
  COMPOSE_FILE := ./docker-compose.yml
  HEALTH_CMD := curl -sf http://localhost:3000/health
endif

DOCKER_COMPOSE := docker compose -f $(COMPOSE_FILE)

help:
	@echo "img-board Makefile (IMGBOARD_ENV=$(IMGBOARD_ENV))"
	@echo ""
	@echo "Development:"
	@echo "  make install        Install npm dependencies"
	@echo "  make dev            Start server (dev mode)"
	@echo "  make dev-preprocess Start preprocessor (dev mode)"
	@echo "  make start          Start both processes locally"
	@echo ""
	@echo "Docker:"
	@echo "  make up             Build and start container"
	@echo "  make down           Stop container"
	@echo "  make logs           Follow container logs"
	@echo "  make restart        Restart container"
	@echo "  make ps             Show container status"
	@echo "  make build          Build image only"
	@echo "  make health         Check health endpoint"
	@echo ""
	@echo "Production (IMGBOARD_ENV=prod):"
	@echo "  make deploy         Full deployment"
	@echo "  make setup          Initial host setup"
	@echo "  make certs          Update TLS certificates"
	@echo ""
	@echo "Utility:"
	@echo "  make clean          Remove stopped containers and dangling images"

install:
	npm install

dev:
	npm run dev

dev-preprocess:
	npm run dev:preprocess

start:
	node start.js

up:
	$(DOCKER_COMPOSE) up -d --build

down:
	$(DOCKER_COMPOSE) down --remove-orphans

logs:
	$(DOCKER_COMPOSE) logs -f

restart:
	$(DOCKER_COMPOSE) restart

ps:
	$(DOCKER_COMPOSE) ps

build:
	$(DOCKER_COMPOSE) build

health:
	@$(HEALTH_CMD) && echo "OK" || echo "FAILED"

deploy:
	./deploy/deploy.sh

setup:
	./deploy/setup.sh

certs:
	./deploy/update-certs.sh

clean:
	docker container prune -f
	docker image prune -f
