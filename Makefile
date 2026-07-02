SHELL := /bin/sh

ROOT_DIR := $(CURDIR)
DEV_PORT ?= 5173
DEV_URL ?= http://localhost:$(DEV_PORT)
MAKE_STATE_DIR ?= .make
DEV_PID_FILE ?= $(ROOT_DIR)/$(MAKE_STATE_DIR)/dev.pid
DEV_LOG_FILE ?= $(ROOT_DIR)/$(MAKE_STATE_DIR)/dev.log
CURL_TIMEOUT ?= 6
SCRIPT_ID ?= 1
HARDWARE_ARTIFACTS_DIR ?= $(ROOT_DIR)/artifacts/hardware
SOAK_PID_FILE ?= $(ROOT_DIR)/$(MAKE_STATE_DIR)/shelly-soak.pid
SOAK_RUN_FILE ?= $(ROOT_DIR)/$(MAKE_STATE_DIR)/shelly-soak.env
SOAK_SCRIPT_FILE ?= $(ROOT_DIR)/$(MAKE_STATE_DIR)/shelly-soak.sh
SOAK_SCREEN_SESSION ?= lcl-soak
SOAK_INTERVAL_MS ?= 5000
SOAK_RPC_TIMEOUT_MS ?= 4000
SOAK_DURATION_MS ?= 0
SOAK_OVERNIGHT_DURATION_MS ?= 28800000
SOAK_OUT_FILE ?=
SOAK_SUMMARY_FILE ?=
SOAK_LOG_FILE ?=
SOAK_ERROR_LOG_FILE ?=
SOAK_CYCLE_RELAY ?= 0
SOAK_CYCLE_PERIOD_MS ?= 120000
SOAK_CYCLE_MARGIN ?=
SOAK_CYCLE_MIN_CHANGE_MS ?= 1000
SOAK_CYCLE_MAX_ON_MS ?= 180000
SOAK_CYCLE_CONSECUTIVE_HITS ?= 1
SOAK_FINAL_OFF ?= 1
SOAK_STOP_SCRIPT_ON_FINISH ?= 1

.DEFAULT_GOAL := help

.PHONY: help install start stop restart status logs open dev test test-watch lint typecheck build check format format-check tokens diagnose shelly-status shelly-diag shelly-install shelly-off shelly-soak-start shelly-soak-overnight shelly-soak-run shelly-soak-stop shelly-soak-status shelly-soak-logs esp32-ble-status clean

help: ## Show available make targets.
	@awk 'BEGIN {FS = ":.*## "; printf "\nLocal Climate Link shortcuts\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-24s %s\n", $$1, $$2} END {printf "\nEnv examples:\n  SHELLY_URL=http://<shelly-ip> SENSOR_MAC=<aa:bb:cc:dd:ee:ff> make shelly-install\n  SHELLY_URL=http://<shelly-ip> make shelly-diag\n  SHELLY_URL=http://<shelly-ip> SOAK_CYCLE_RELAY=1 make shelly-soak-start\n  SHELLY_URL=http://<shelly-ip> make shelly-soak-overnight\n  make shelly-soak-stop\n  ESP32_URL=http://<esp32-ip> make esp32-ble-status\n\n"}' $(MAKEFILE_LIST)

install: ## Install dependencies with the lockfile.
	CI=1 pnpm install --frozen-lockfile

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
	@if [ -f "$(SOAK_PID_FILE)" ] && kill -0 "$$(cat "$(SOAK_PID_FILE)")" 2>/dev/null; then \
		echo "shelly soak: running, pid $$(cat "$(SOAK_PID_FILE)")"; \
	elif command -v screen >/dev/null 2>&1 && screen -ls 2>/dev/null | grep -q "[.]$(SOAK_SCREEN_SESSION)[[:space:]]"; then \
		echo "shelly soak: screen session $(SOAK_SCREEN_SESSION) exists, but pid file is stale/missing"; \
	else \
		echo "shelly soak: stopped"; \
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

shelly-soak-start: ## Start long Shelly soak logging in the background. Requires SHELLY_URL.
	@: $${SHELLY_URL:?Set SHELLY_URL=http://<shelly-ip>}
	@mkdir -p "$(MAKE_STATE_DIR)" "$(HARDWARE_ARTIFACTS_DIR)"
	@if [ -f "$(SOAK_PID_FILE)" ] && kill -0 "$$(cat "$(SOAK_PID_FILE)")" 2>/dev/null; then \
		echo "Shelly soak already running: pid $$(cat "$(SOAK_PID_FILE)")"; \
		if [ -f "$(SOAK_RUN_FILE)" ]; then . "$(SOAK_RUN_FILE)"; echo "jsonl: $$SOAK_OUT_FILE"; echo "summary: $$SOAK_SUMMARY_FILE"; echo "log: $$SOAK_LOG_FILE"; echo "error log: $$SOAK_ERROR_LOG_FILE"; fi; \
	elif command -v screen >/dev/null 2>&1 && screen -ls 2>/dev/null | grep -q "[.]$(SOAK_SCREEN_SESSION)[[:space:]]"; then \
		echo "Shelly soak screen session already exists: $(SOAK_SCREEN_SESSION)"; \
		if [ -f "$(SOAK_RUN_FILE)" ]; then . "$(SOAK_RUN_FILE)"; echo "jsonl: $$SOAK_OUT_FILE"; echo "summary: $$SOAK_SUMMARY_FILE"; echo "log: $$SOAK_LOG_FILE"; echo "error log: $$SOAK_ERROR_LOG_FILE"; fi; \
	else \
		run_id=$$(date -u +"%Y%m%dT%H%M%SZ"); \
		out_file="$(SOAK_OUT_FILE)"; \
		if [ -z "$$out_file" ]; then out_file="$(HARDWARE_ARTIFACTS_DIR)/shelly-soak-$$run_id.jsonl"; fi; \
		case "$$out_file" in /*) ;; *) out_file="$(ROOT_DIR)/$$out_file";; esac; \
		summary_file="$(SOAK_SUMMARY_FILE)"; \
		if [ -z "$$summary_file" ]; then summary_file="$${out_file%.jsonl}.summary.md"; fi; \
		case "$$summary_file" in /*) ;; *) summary_file="$(ROOT_DIR)/$$summary_file";; esac; \
		log_file="$(SOAK_LOG_FILE)"; \
		if [ -z "$$log_file" ]; then log_file="$${out_file%.jsonl}.log"; fi; \
		case "$$log_file" in /*) ;; *) log_file="$(ROOT_DIR)/$$log_file";; esac; \
		error_log_file="$(SOAK_ERROR_LOG_FILE)"; \
		if [ -z "$$error_log_file" ]; then error_log_file="$${log_file%.log}.err.log"; fi; \
		case "$$error_log_file" in /*) ;; *) error_log_file="$(ROOT_DIR)/$$error_log_file";; esac; \
		node_bin=$$(command -v node); \
		if [ -z "$$node_bin" ]; then \
			echo "node is missing; run make install first"; \
			exit 1; \
		fi; \
		tsx_cli="$(ROOT_DIR)/node_modules/tsx/dist/cli.mjs"; \
		if [ ! -f "$$tsx_cli" ]; then \
			echo "$$tsx_cli is missing; run make install first"; \
			exit 1; \
		fi; \
		rm -f "$(SOAK_PID_FILE)" "$(SOAK_RUN_FILE)" "$(SOAK_SCRIPT_FILE)"; \
		: > "$$log_file"; \
		: > "$$error_log_file"; \
		printf '%s\n' '#!/bin/sh' >"$(SOAK_SCRIPT_FILE)"; \
		printf 'cd "%s" || exit 1\n' "$(ROOT_DIR)" >>"$(SOAK_SCRIPT_FILE)"; \
		printf 'echo "$$$$" > "%s"\n' "$(SOAK_PID_FILE)" >>"$(SOAK_SCRIPT_FILE)"; \
		printf 'exec env SHELLY_URL="%s" SCRIPT_ID="%s" SOAK_OUT_FILE="%s" SOAK_SUMMARY_FILE="%s" SOAK_INTERVAL_MS="%s" SOAK_RPC_TIMEOUT_MS="%s" SOAK_DURATION_MS="%s" SOAK_CYCLE_RELAY="%s" SOAK_CYCLE_PERIOD_MS="%s" SOAK_CYCLE_MARGIN="%s" SOAK_CYCLE_MIN_CHANGE_MS="%s" SOAK_CYCLE_MAX_ON_MS="%s" SOAK_CYCLE_CONSECUTIVE_HITS="%s" SOAK_FINAL_OFF="%s" SOAK_STOP_SCRIPT_ON_FINISH="%s" "%s" "%s" "%s" >> "%s" 2>> "%s"\n' "$$SHELLY_URL" "$(SCRIPT_ID)" "$$out_file" "$$summary_file" "$(SOAK_INTERVAL_MS)" "$(SOAK_RPC_TIMEOUT_MS)" "$(SOAK_DURATION_MS)" "$(SOAK_CYCLE_RELAY)" "$(SOAK_CYCLE_PERIOD_MS)" "$(SOAK_CYCLE_MARGIN)" "$(SOAK_CYCLE_MIN_CHANGE_MS)" "$(SOAK_CYCLE_MAX_ON_MS)" "$(SOAK_CYCLE_CONSECUTIVE_HITS)" "$(SOAK_FINAL_OFF)" "$(SOAK_STOP_SCRIPT_ON_FINISH)" "$$node_bin" "$$tsx_cli" "$(ROOT_DIR)/scripts/hardware/shelly-soak-logger.ts" "$$log_file" "$$error_log_file" >>"$(SOAK_SCRIPT_FILE)"; \
		chmod +x "$(SOAK_SCRIPT_FILE)"; \
		printf 'SOAK_OUT_FILE=%s\nSOAK_SUMMARY_FILE=%s\nSOAK_LOG_FILE=%s\nSOAK_ERROR_LOG_FILE=%s\nSOAK_SCRIPT_FILE=%s\nSOAK_SCREEN_SESSION=%s\nSOAK_CYCLE_RELAY=%s\nSOAK_CYCLE_PERIOD_MS=%s\nSOAK_CYCLE_MARGIN=%s\nSOAK_CYCLE_MIN_CHANGE_MS=%s\nSOAK_CYCLE_MAX_ON_MS=%s\nSOAK_CYCLE_CONSECUTIVE_HITS=%s\nSOAK_FINAL_OFF=%s\nSOAK_STOP_SCRIPT_ON_FINISH=%s\n' "$$out_file" "$$summary_file" "$$log_file" "$$error_log_file" "$(SOAK_SCRIPT_FILE)" "$(SOAK_SCREEN_SESSION)" "$(SOAK_CYCLE_RELAY)" "$(SOAK_CYCLE_PERIOD_MS)" "$(SOAK_CYCLE_MARGIN)" "$(SOAK_CYCLE_MIN_CHANGE_MS)" "$(SOAK_CYCLE_MAX_ON_MS)" "$(SOAK_CYCLE_CONSECUTIVE_HITS)" "$(SOAK_FINAL_OFF)" "$(SOAK_STOP_SCRIPT_ON_FINISH)" >"$(SOAK_RUN_FILE)"; \
		if command -v screen >/dev/null 2>&1; then \
			screen -dmS "$(SOAK_SCREEN_SESSION)" "$(SOAK_SCRIPT_FILE)"; \
			sleep 1; \
			if [ -f "$(SOAK_PID_FILE)" ] && kill -0 "$$(cat "$(SOAK_PID_FILE)")" 2>/dev/null; then \
				echo "started Shelly soak in screen $(SOAK_SCREEN_SESSION): pid $$(cat "$(SOAK_PID_FILE)")"; \
			else \
				echo "Shelly soak failed to stay running in screen $(SOAK_SCREEN_SESSION)"; \
				echo "stdout log: $$log_file"; \
				echo "error log: $$error_log_file"; \
				screen -S "$(SOAK_SCREEN_SESSION)" -X quit 2>/dev/null || true; \
				exit 1; \
			fi; \
		else \
			"$(SOAK_SCRIPT_FILE)" >/dev/null 2>&1 & \
			sleep 1; \
			if [ -f "$(SOAK_PID_FILE)" ] && kill -0 "$$(cat "$(SOAK_PID_FILE)")" 2>/dev/null; then \
				echo "started Shelly soak: pid $$(cat "$(SOAK_PID_FILE)")"; \
			else \
				echo "Shelly soak failed to stay running"; \
				echo "stdout log: $$log_file"; \
				echo "error log: $$error_log_file"; \
				exit 1; \
			fi; \
		fi; \
		echo "jsonl: $$out_file"; \
		echo "summary: $$summary_file"; \
		echo "log: $$log_file"; \
		echo "error log: $$error_log_file"; \
	fi

shelly-soak-overnight: ## Start an 8h active Shelly soak with real ON/OFF cycling. Requires SHELLY_URL.
	@: $${SHELLY_URL:?Set SHELLY_URL=http://<shelly-ip>}
	@base="$${SHELLY_URL%/}"; \
	echo "starting Shelly script $(SCRIPT_ID) before overnight soak"; \
	if command -v jq >/dev/null 2>&1; then \
		curl -sS --max-time "$(CURL_TIMEOUT)" "$$base/rpc/Script.Start?id=$(SCRIPT_ID)" | jq .; \
	else \
		curl -sS --max-time "$(CURL_TIMEOUT)" "$$base/rpc/Script.Start?id=$(SCRIPT_ID)"; echo ""; \
	fi; \
	$(MAKE) --no-print-directory shelly-soak-start SHELLY_URL="$$SHELLY_URL" SCRIPT_ID="$(SCRIPT_ID)" SOAK_CYCLE_RELAY=1 SOAK_DURATION_MS="$(SOAK_OVERNIGHT_DURATION_MS)" SOAK_FINAL_OFF=1 SOAK_STOP_SCRIPT_ON_FINISH=1

shelly-soak-run: ## Run long Shelly soak logging in the foreground. Requires SHELLY_URL.
	@: $${SHELLY_URL:?Set SHELLY_URL=http://<shelly-ip>}
	@mkdir -p "$(HARDWARE_ARTIFACTS_DIR)"
	@run_id=$$(date -u +"%Y%m%dT%H%M%SZ"); \
	out_file="$(SOAK_OUT_FILE)"; \
	if [ -z "$$out_file" ]; then out_file="$(HARDWARE_ARTIFACTS_DIR)/shelly-soak-$$run_id.jsonl"; fi; \
	case "$$out_file" in /*) ;; *) out_file="$(ROOT_DIR)/$$out_file";; esac; \
	summary_file="$(SOAK_SUMMARY_FILE)"; \
	if [ -z "$$summary_file" ]; then summary_file="$${out_file%.jsonl}.summary.md"; fi; \
	case "$$summary_file" in /*) ;; *) summary_file="$(ROOT_DIR)/$$summary_file";; esac; \
	node_bin=$$(command -v node); \
	if [ -z "$$node_bin" ]; then echo "node is missing; run make install first"; exit 1; fi; \
	tsx_cli="$(ROOT_DIR)/node_modules/tsx/dist/cli.mjs"; \
	if [ ! -f "$$tsx_cli" ]; then echo "$$tsx_cli is missing; run make install first"; exit 1; fi; \
	SHELLY_URL="$$SHELLY_URL" SCRIPT_ID="$(SCRIPT_ID)" SOAK_OUT_FILE="$$out_file" SOAK_SUMMARY_FILE="$$summary_file" SOAK_INTERVAL_MS="$(SOAK_INTERVAL_MS)" SOAK_RPC_TIMEOUT_MS="$(SOAK_RPC_TIMEOUT_MS)" SOAK_DURATION_MS="$(SOAK_DURATION_MS)" SOAK_CYCLE_RELAY="$(SOAK_CYCLE_RELAY)" SOAK_CYCLE_PERIOD_MS="$(SOAK_CYCLE_PERIOD_MS)" SOAK_CYCLE_MARGIN="$(SOAK_CYCLE_MARGIN)" SOAK_CYCLE_MIN_CHANGE_MS="$(SOAK_CYCLE_MIN_CHANGE_MS)" SOAK_CYCLE_MAX_ON_MS="$(SOAK_CYCLE_MAX_ON_MS)" SOAK_CYCLE_CONSECUTIVE_HITS="$(SOAK_CYCLE_CONSECUTIVE_HITS)" SOAK_FINAL_OFF="$(SOAK_FINAL_OFF)" SOAK_STOP_SCRIPT_ON_FINISH="$(SOAK_STOP_SCRIPT_ON_FINISH)" "$$node_bin" "$$tsx_cli" "$(ROOT_DIR)/scripts/hardware/shelly-soak-logger.ts"

shelly-soak-stop: ## Stop the background Shelly soak logger and keep its data files.
	@if [ -f "$(SOAK_PID_FILE)" ] && kill -0 "$$(cat "$(SOAK_PID_FILE)")" 2>/dev/null; then \
		pid="$$(cat "$(SOAK_PID_FILE)")"; \
		echo "stopping Shelly soak: pid $$pid"; \
		kill -INT "$$pid"; \
		i=0; \
		while kill -0 "$$pid" 2>/dev/null && [ "$$i" -lt 30 ]; do sleep 1; i=$$((i + 1)); done; \
		if kill -0 "$$pid" 2>/dev/null; then \
			echo "Shelly soak did not stop after SIGINT, sending SIGTERM"; \
			kill -TERM "$$pid"; \
			i=0; \
			while kill -0 "$$pid" 2>/dev/null && [ "$$i" -lt 10 ]; do sleep 1; i=$$((i + 1)); done; \
		fi; \
		rm -f "$(SOAK_PID_FILE)"; \
		if command -v screen >/dev/null 2>&1 && screen -ls 2>/dev/null | grep -q "[.]$(SOAK_SCREEN_SESSION)[[:space:]]"; then screen -S "$(SOAK_SCREEN_SESSION)" -X quit 2>/dev/null || true; fi; \
		if [ -f "$(SOAK_RUN_FILE)" ]; then . "$(SOAK_RUN_FILE)"; echo "jsonl: $$SOAK_OUT_FILE"; echo "summary: $$SOAK_SUMMARY_FILE"; echo "log: $$SOAK_LOG_FILE"; echo "error log: $$SOAK_ERROR_LOG_FILE"; fi; \
	else \
		echo "Shelly soak is not running from $(SOAK_PID_FILE)"; \
		if command -v screen >/dev/null 2>&1 && screen -ls 2>/dev/null | grep -q "[.]$(SOAK_SCREEN_SESSION)[[:space:]]"; then \
			echo "stopping stale screen session $(SOAK_SCREEN_SESSION)"; \
			screen -S "$(SOAK_SCREEN_SESSION)" -X quit 2>/dev/null || true; \
		fi; \
		rm -f "$(SOAK_PID_FILE)"; \
		if [ -f "$(SOAK_RUN_FILE)" ]; then . "$(SOAK_RUN_FILE)"; echo "last jsonl: $$SOAK_OUT_FILE"; echo "last summary: $$SOAK_SUMMARY_FILE"; echo "last log: $$SOAK_LOG_FILE"; echo "last error log: $$SOAK_ERROR_LOG_FILE"; fi; \
	fi

shelly-soak-status: ## Show Shelly soak logger status and latest sample paths.
	@pid=""; \
	if [ -f "$(SOAK_PID_FILE)" ] && kill -0 "$$(cat "$(SOAK_PID_FILE)")" 2>/dev/null; then \
		pid="$$(cat "$(SOAK_PID_FILE)")"; \
	fi; \
	if [ -n "$$pid" ]; then \
		echo "Shelly soak: running, pid $$pid"; \
	elif command -v screen >/dev/null 2>&1 && screen -ls 2>/dev/null | grep -q "[.]$(SOAK_SCREEN_SESSION)[[:space:]]"; then \
		echo "Shelly soak: screen session $(SOAK_SCREEN_SESSION) exists, but pid file is stale/missing"; \
	else \
		echo "Shelly soak: stopped"; \
	fi
	@if [ -f "$(SOAK_RUN_FILE)" ]; then \
		. "$(SOAK_RUN_FILE)"; \
		echo "jsonl: $$SOAK_OUT_FILE"; \
		echo "summary: $$SOAK_SUMMARY_FILE"; \
		echo "log: $$SOAK_LOG_FILE"; \
		echo "error log: $$SOAK_ERROR_LOG_FILE"; \
		if [ -n "$$SOAK_SCREEN_SESSION" ] && command -v screen >/dev/null 2>&1 && screen -ls 2>/dev/null | grep -q "[.]$$SOAK_SCREEN_SESSION[[:space:]]"; then echo "screen: $$SOAK_SCREEN_SESSION"; fi; \
		if [ -f "$$SOAK_OUT_FILE" ]; then echo ""; tail -n 3 "$$SOAK_OUT_FILE"; fi; \
	else \
		echo "No Shelly soak run file at $(SOAK_RUN_FILE)"; \
	fi

shelly-soak-logs: ## Follow the background Shelly soak logger stdout log.
	@if [ -f "$(SOAK_RUN_FILE)" ]; then \
		. "$(SOAK_RUN_FILE)"; \
		touch "$$SOAK_LOG_FILE"; \
		touch "$$SOAK_ERROR_LOG_FILE"; \
		tail -f "$$SOAK_LOG_FILE" "$$SOAK_ERROR_LOG_FILE"; \
	else \
		echo "No Shelly soak run file at $(SOAK_RUN_FILE)"; \
		exit 1; \
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
