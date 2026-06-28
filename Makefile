SHELL := /bin/sh

ROOT_DIR := $(CURDIR)
DEV_PORT ?= 5173
DEV_URL ?= http://localhost:$(DEV_PORT)
MAKE_STATE_DIR ?= .make
DEV_PID_FILE ?= $(ROOT_DIR)/$(MAKE_STATE_DIR)/dev.pid
DEV_LOG_FILE ?= $(ROOT_DIR)/$(MAKE_STATE_DIR)/dev.log
CURL_TIMEOUT ?= 6
SCRIPT_ID ?= 1

.DEFAULT_GOAL := help

.PHONY: help install start stop restart status logs open dev test test-watch lint typecheck build check format format-check tokens diagnose shelly-status shelly-diag shelly-install shelly-off esp32-ble-status clean

help: ## Show available make targets.
	@awk 'BEGIN {FS = ":.*## "; printf "\nLocal Climate Link shortcuts\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-22s %s\n", $$1, $$2} END {printf "\nEnv examples:\n  SHELLY_URL=http://<shelly-ip> SENSOR_MAC=<aa:bb:cc:dd:ee:ff> make shelly-install\n  SHELLY_URL=http://<shelly-ip> make shelly-diag\n  ESP32_URL=http://<esp32-ip> make esp32-ble-status\n\n"}' $(MAKEFILE_LIST)

install: ## Install dependencies with the lockfile.
	pnpm install --frozen-lockfile

start: ## Start the Vite dev server in the background.
	@mkdir -p "$(MAKE_STATE_DIR)"
	@if [ -f "$(DEV_PID_FILE)" ] && kill -0 "$$(cat "$(DEV_PID_FILE)")" 2>/dev/null; then \
		echo "dev server already running: pid $$(cat "$(DEV_PID_FILE)")"; \
		echo "$(DEV_URL)"; \
	else \
		if [ ! -x "apps/mobile/node_modules/.bin/vite" ]; then \
			echo "apps/mobile/node_modules/.bin/vite is missing; run make install first"; \
			exit 1; \
		fi; \
		rm -f "$(DEV_PID_FILE)"; \
		cd apps/mobile || exit 1; \
		nohup ./node_modules/.bin/vite --host 0.0.0.0 --port "$(DEV_PORT)" >"$(DEV_LOG_FILE)" 2>&1 & \
		echo $$! >"$(DEV_PID_FILE)"; \
		echo "started dev server: pid $$(cat "$(DEV_PID_FILE)")"; \
		echo "$(DEV_URL)"; \
		echo "logs: $(DEV_LOG_FILE)"; \
	fi

stop: ## Stop the background Vite dev server started by make start.
	@if [ -f "$(DEV_PID_FILE)" ] && kill -0 "$$(cat "$(DEV_PID_FILE)")" 2>/dev/null; then \
		kill "$$(cat "$(DEV_PID_FILE)")"; \
		echo "stopped dev server: pid $$(cat "$(DEV_PID_FILE)")"; \
		rm -f "$(DEV_PID_FILE)"; \
	else \
		echo "dev server is not running from $(DEV_PID_FILE)"; \
		rm -f "$(DEV_PID_FILE)"; \
	fi

restart: stop start ## Restart the background Vite dev server.

status: ## Show local git and dev server status.
	@git status -sb
	@if [ -f "$(DEV_PID_FILE)" ] && kill -0 "$$(cat "$(DEV_PID_FILE)")" 2>/dev/null; then \
		echo "dev server: running, pid $$(cat "$(DEV_PID_FILE)")"; \
		echo "url: $(DEV_URL)"; \
	else \
		echo "dev server: stopped"; \
	fi

logs: ## Follow the background dev server log.
	@mkdir -p "$(MAKE_STATE_DIR)"
	@touch "$(DEV_LOG_FILE)"
	tail -f "$(DEV_LOG_FILE)"

open: ## Open the Vite dev URL in the default browser on macOS.
	open "$(DEV_URL)"

dev: ## Run the Vite dev server in the foreground.
	pnpm dev

test: ## Run unit/component tests.
	pnpm test

test-watch: ## Run tests in watch mode.
	pnpm test:watch

lint: ## Run ESLint.
	pnpm lint

typecheck: ## Run TypeScript typechecks.
	pnpm typecheck

build: ## Build all packages and the mobile web app.
	pnpm build

check: ## Run format check, lint, typecheck, tests, and build.
	pnpm check

format: ## Format the repository.
	pnpm format

format-check: ## Check repository formatting.
	pnpm format:check

tokens: ## Build design tokens.
	pnpm tokens:build

diagnose: ## Print local diagnostics; also probes Shelly when SHELLY_URL is set.
	@echo "node: $$(node --version 2>/dev/null || echo missing)"
	@echo "pnpm: $$(pnpm --version 2>/dev/null || echo missing)"
	@echo "make: $$(make --version 2>/dev/null | sed -n '1p' || echo missing)"
	@echo "branch: $$(git branch --show-current 2>/dev/null || echo unknown)"
	@git status -sb
	@echo "latest commit: $$(git log -1 --oneline 2>/dev/null || echo unknown)"
	@if [ -n "$$SHELLY_URL" ]; then \
		base="$${SHELLY_URL%/}"; \
		echo ""; \
		echo "Shelly diagnostics from $$base"; \
		for endpoint in Shelly.GetDeviceInfo Shelly.GetStatus Script.List; do \
			echo ""; \
			echo "$$endpoint"; \
			if command -v jq >/dev/null 2>&1; then \
				curl -sS --max-time "$(CURL_TIMEOUT)" "$$base/rpc/$$endpoint" | jq .; \
			else \
				curl -sS --max-time "$(CURL_TIMEOUT)" "$$base/rpc/$$endpoint"; echo ""; \
			fi; \
		done; \
	else \
		echo ""; \
		echo "SHELLY_URL not set, skipping Shelly probe."; \
	fi

shelly-status: ## Show Shelly device/script/relay status. Requires SHELLY_URL.
	@: $${SHELLY_URL:?Set SHELLY_URL=http://<shelly-ip>}
	@base="$${SHELLY_URL%/}"; \
	for request in "Shelly.GetDeviceInfo" "Shelly.GetStatus" "Script.List" "Script.GetStatus?id=$(SCRIPT_ID)" "Switch.GetStatus?id=0"; do \
		echo ""; \
		echo "$$request"; \
		if command -v jq >/dev/null 2>&1; then \
			curl -sS --max-time "$(CURL_TIMEOUT)" "$$base/rpc/$$request" | jq .; \
		else \
			curl -sS --max-time "$(CURL_TIMEOUT)" "$$base/rpc/$$request"; echo ""; \
		fi; \
	done

shelly-diag: ## Read generated thermostat diagnostics endpoint. Requires SHELLY_URL.
	@: $${SHELLY_URL:?Set SHELLY_URL=http://<shelly-ip>}
	@if command -v jq >/dev/null 2>&1; then \
		curl -sS --max-time "$(CURL_TIMEOUT)" "$${SHELLY_URL%/}/script/$(SCRIPT_ID)/diag" | jq .; \
	else \
		curl -sS --max-time "$(CURL_TIMEOUT)" "$${SHELLY_URL%/}/script/$(SCRIPT_ID)/diag"; echo ""; \
	fi

shelly-install: ## Generate/install thermostat script and observe diagnostics. Requires SHELLY_URL and SENSOR_MAC.
	@: $${SHELLY_URL:?Set SHELLY_URL=http://<shelly-ip>}
	@: $${SENSOR_MAC:?Set SENSOR_MAC=<aa:bb:cc:dd:ee:ff>}
	pnpm hardware:shelly:install

shelly-off: ## Send Switch.Set OFF to Shelly relay 0. Requires SHELLY_URL.
	@: $${SHELLY_URL:?Set SHELLY_URL=http://<shelly-ip>}
	@if command -v jq >/dev/null 2>&1; then \
		curl -sS --max-time "$(CURL_TIMEOUT)" "$${SHELLY_URL%/}/rpc/Switch.Set?id=0&on=false" | jq .; \
	else \
		curl -sS --max-time "$(CURL_TIMEOUT)" "$${SHELLY_URL%/}/rpc/Switch.Set?id=0&on=false"; echo ""; \
	fi

esp32-ble-status: ## Read ESP32 BLE scanner status. Requires ESP32_URL.
	@: $${ESP32_URL:?Set ESP32_URL=http://<esp32-ip>}
	@if command -v jq >/dev/null 2>&1; then \
		curl -sS --max-time "$(CURL_TIMEOUT)" "$${ESP32_URL%/}/api/ble/status" | jq .; \
	else \
		curl -sS --max-time "$(CURL_TIMEOUT)" "$${ESP32_URL%/}/api/ble/status"; echo ""; \
	fi

clean: stop ## Remove make runtime files.
	rm -rf "$(MAKE_STATE_DIR)"
