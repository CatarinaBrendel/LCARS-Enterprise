SHELL := /bin/bash
DOCKER := docker
DC := $(DOCKER) compose
SERVICES := proxy api vite db

.DEFAULT_GOAL := help

help:
	@echo "Usage: make <target>"; echo; \
	awk 'BEGIN {FS = ":.*?## "}; /^[a-zA-Z0-9_.-]+:.*?## / {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## docker compose up -d (build & wait for health)
	$(DC) up --build -d
	@echo "Waiting for services to be healthy..."; \
	$(DC) ps

down: ## docker compose down (remove orphans)
	$(DC) down --remove-orphans

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
