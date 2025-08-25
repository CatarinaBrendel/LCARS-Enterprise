## -- Backend -- ## 
SHELL := /bin/bash
DOCKER := docker
DC := $(DOCKER) compose
SERVICES := proxy api vite db

.DEFAULT_GOAL := help

help:
	@echo "Usage: make <target>"; echo; \
	awk 'BEGIN {FS = ":.*?## "}; /^[a-zA-Z0-9_.-]+:.*?## / {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## docker compose up -d (build & wait for health)
	$(DC) up --build -d $(SERVICES)
	@echo "Waiting for services to be healthy..."; \
	$(DC) ps

down: ## docker compose down (remove orphans)
	$(DC) down --remove-orphans $(SERVICES)

ps: ## docker compose ps
	$(DC) ps

logs: ## docker compose logs -f
	$(DC) logs -f $(SERVICES)

restart: ## restart api & proxy
	-$(DC) restart api proxy

sh-%: ## make sh-[service]
	$(DC) exec $* sh

bash-%: ## make bash-[service]
	$(DC) exec $* bash

psql: ## open psql (db must be running)
	$(DOCKER) exec -it $$($(DC) ps -q db) psql -U app -d appdb

# Danger: wipe DB data for a totally fresh start
reset-db: ## remove pgdata volume (DANGEROUS)
	-$(DOCKER) volume rm $$(basename $$PWD)_pgdata || true

## -- Database Migrations -- ##
COMPOSE_PROJECT_NAME ?= lcars-enterprise

# --- Dev ---

dev-up:
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile dev up -d db

dev-migrate: ## run migrations in dev
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile dev build migrate-dev
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile dev run --rm migrate-dev

dev-reset: ## blow away dev DB and rerun migrations
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile dev down -v
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile dev up -d db
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile dev build migrate-dev
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile dev run --rm migrate-dev

# --- Test ---

test-up:
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile test up -d db migrate-test

test-run: ## run api-tests container against test DB
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile test run --rm --no-deps api-tests

test-reset: ## drop + recreate test DB with migrations
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile test down -v
	docker compose -p $(COMPOSE_PROJECT_NAME) --profile test up -d db migrate-test


## -- Backend Test within Container -- ##
cli-test:
	COMPOSE_PROJECT_NAME=lcars-enterprise docker compose --profile test up -d db migrate-test
	COMPOSE_PROJECT_NAME=lcars-enterprise docker compose --profile test run --rm --no-deps api-tests
	COMPOSE_PROJECT_NAME=lcars-enterprise docker compose --profile test down -v --remove-orphans


## -- Frontend -- ## 
# Variables
FRONTEND_DIR = frontend
FRONTEND_NODE_BIN = $(FRONTEND_DIR)/node_modules/.bin

.PHONY: frontend frontend-dev frontend-build

# Default frontend target
frontend: frontend-dev

# Start Vite dev server for frontend (Electron loads from localhost)
frontend-dev:
	cd $(FRONTEND_DIR) && npm install && npm run dev & \
	npx wait-on http://localhost:5173 && \
	cd ../main && npm install && npm run dev

# Build frontend production assets
frontend-build:
	@echo "Building frontend production assets..."
	cd $(FRONTEND_DIR) && npm install && npm run build
	

## -- Electron -- ##
ELECTRON_DIR = main

electron-dev: ## Start Electron app (loads from localhost:5173)
	@echo "Starting Electron..."
	cd $(ELECTRON_DIR) && npm install && npm run dev


## -- Combined Dev -- ##
dev: ## Run frontend and Electron together
	@echo "Starting frontend + Electron in parallel..."
	cd $(FRONTEND_DIR) && npm install
	cd $(ELECTRON_DIR) && npm install
	npx concurrently \
		"cd $(FRONTEND_DIR) && npm run dev" \
		"cd $(ELECTRON_DIR) && npm run dev"
