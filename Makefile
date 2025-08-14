# ---- Makefile ----
SHELL := /bin/bash
DOCKER := docker
DC := $(DOCKER) compose
SERVICES := proxy api vite db

.DEFAULT_GOAL := help

## Show this help
help:
	@echo "Usage: make <target>"
	@echo
	@awk 'BEGIN {FS = ":.*?## "}; /^[a-zA-Z0-9_.-]+:.*?## / {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Build & start containers in the background
up:  ## docker compose up -d
	$(DC) up --build -d

## Follow logs (Ctrl-C to stop)
logs: ## docker compose logs -f
	$(DC) logs -f $(SERVICES)

## Stop and remove containers (keeps volumes & images)
down: ## docker compose down
	$(DC) down

## Restart API & proxy (fast)
restart: ## docker compose restart api proxy
	-$(DC) restart api proxy

## Show container status
ps: ## docker compose ps
	$(DC) ps

# ---- Shell access shortcuts ----
sh-%: ## make sh-[service] → open sh in that service
	$(DC) exec $* sh

bash-%: ## make bash-[service] → open bash in that service
	$(DC) exec $* bash

## PSQL shell to DB
psql: ## open Postgres psql shell
	$(DOCKER) exec -it $$( $(DC) ps -q db ) psql -U app -d appdb

## Run backend tests inside API
test-backend: ## docker compose exec api pnpm test
	$(DC) exec api pnpm test

# ---------- Frontend (host) ----------
## Start Vite+Electron on host (hot reload)
frontend: ## cd frontend && pnpm dev
	cd frontend && pnpm dev

## Lint frontend on host
lint-frontend: ## cd frontend && pnpm lint
	cd frontend && pnpm lint

# ---------- Cleanup ----------
## Prune images/containers/networks/volumes older than 24h (safe)
prune-day: ## docker system prune (older than 24h)
	$(DOCKER) system prune -af --filter "until=24h"
	$(DOCKER) volume prune -f
	$(DOCKER) builder prune -af --filter "until=24h"


## Aggressive cleanup (everything unused NOW) ⚠️
prune-all: ## docker system prune NOW (danger)
	$(DOCKER) system prune -af --volumes
	$(DOCKER) builder prune -af

## Stop stack and prune old resources (24h)
clean: down prune-day ## down + prune-day
	@echo "Stack stopped and old resources pruned."
