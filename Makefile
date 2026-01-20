.PHONY: help install dev dev-preprocess start up down logs restart ps build health deploy setup certs ensure-certs clean

# Default to dev; override with IMGBOARD_ENV=prod
IMGBOARD_ENV ?= dev

# Compose files
COMPOSE_BASE := docker-compose.yaml
COMPOSE_LOCAL := docker-compose.local.yaml

ifeq ($(IMGBOARD_ENV),prod)
  DOCKER_COMPOSE := docker compose -f $(COMPOSE_BASE)
  HEALTH_CMD := curl -sf -k https://localhost:3000/health
else
  DOCKER_COMPOSE := docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_LOCAL)
  HEALTH_CMD := curl -sf http://localhost:3000/health
endif

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
	@echo "  make ensure-certs   Generate self-signed certs if missing"
	@echo "  make clean          Remove stopped containers and dangling images"

install:
	npm install

dev: ensure-certs
	npm run dev

dev-preprocess:
	npm run dev:preprocess

start: ensure-certs
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

ensure-certs:
	@if [ ! -f certs/cert.pem ]; then \
		echo "Generating self-signed certificates..."; \
		mkdir -p certs; \
		openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem \
			-sha256 -days 365 -nodes \
			-subj "/CN=localhost" \
			-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"; \
		cp certs/cert.pem certs/chain.pem; \
		echo "Certificates generated in certs/"; \
	else \
		echo "Certificates already exist"; \
	fi

clean:
	docker container prune -f
	docker image prune -f
