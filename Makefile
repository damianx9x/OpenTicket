SHELL := /bin/bash

BACKEND_PORT ?= 3000
FRONTEND_PORT ?= 3001
BIND_HOST ?= 127.0.0.1
BACKEND_HEALTH_HOST ?= 127.0.0.1

.PHONY: up down reset diagnose test smoke metrics stage3-test desktop-dev installer-official installer-official-win moj-testy-start moj-testy-stop moj-testy-reset moj-testy-smoke moj-testy-auth-smoke moj-testy-client-only-smoke moj-testy-profile-ui-smoke moj-testy-backup-ui-smoke moj-testy-custom-path-backup-smoke moj-testy-fresh-10x-smoke moj-testy-setup-import-smoke moj-testy-diagnose moj-testy-open-fresh moj-testy-server-only-deep moj-testy-role-guard ci-ios-typecheck ci-ios-contract-smoke ci-release-artifacts-smoke ci-platform-matrix-smoke

up:
	@BACKEND_PORT=$(BACKEND_PORT) FRONTEND_PORT=$(FRONTEND_PORT) BIND_HOST=$(BIND_HOST) BACKEND_HEALTH_HOST=$(BACKEND_HEALTH_HOST) ./scripts/up.sh

down:
	@BACKEND_PORT=$(BACKEND_PORT) FRONTEND_PORT=$(FRONTEND_PORT) ./scripts/stop.sh --force

reset:
	@APP_ENV=$(APP_ENV) BACKEND_PORT=$(BACKEND_PORT) FRONTEND_PORT=$(FRONTEND_PORT) ./scripts/reset.sh

diagnose:
	@BACKEND_PORT=$(BACKEND_PORT) FRONTEND_PORT=$(FRONTEND_PORT) BACKEND_HEALTH_HOST=$(BACKEND_HEALTH_HOST) ./scripts/diagnose.sh --bundle

test:
	@npm --prefix backend run build
	@npm --prefix frontend run build
	@npm --prefix desktop run build:electron

smoke:
	@BACKEND_PORT=$(BACKEND_PORT) BACKEND_HEALTH_HOST=$(BACKEND_HEALTH_HOST) ./scripts/smoke.sh

metrics:
	@./scripts/code-metrics.sh

stage3-test:
	@./scripts/stage3-go-no-go.sh

desktop-dev:
	@npm --prefix desktop run electron-dev

installer-official:
	@./Moj/build-oficjalna-instalka.sh

installer-official-win:
	@./Moj/build-oficjalna-instalka-win.sh

moj-testy-start:
	@./Moj/testy/start.sh

moj-testy-stop:
	@./Moj/testy/stop.sh

moj-testy-reset:
	@APP_ENV=$(APP_ENV) ./Moj/testy/reset.sh

moj-testy-smoke:
	@./Moj/testy/smoke.sh

moj-testy-auth-smoke:
	@./Moj/testy/auth-smoke.sh

moj-testy-client-only-smoke:
	@./Moj/testy/client-only-smoke.sh

moj-testy-profile-ui-smoke:
	@./Moj/testy/profile-ui-smoke.sh

moj-testy-backup-ui-smoke:
	@./Moj/testy/backup-ui-smoke.sh

moj-testy-custom-path-backup-smoke:
	@./Moj/testy/custom-path-backup-smoke.sh

moj-testy-fresh-10x-smoke:
	@./Moj/testy/fresh-10x-smoke.sh

moj-testy-setup-import-smoke:
	@./Moj/testy/setup-import-smoke.sh

moj-testy-diagnose:
	@./Moj/testy/diagnose.sh

moj-testy-open-fresh:
	@./Moj/testy/open-fresh-browser.sh --reset-profile

moj-testy-server-only-deep:
	@./Moj/testy/server-only-deep-smoke.sh

moj-testy-role-guard:
	@./Moj/testy/role-guard-smoke.sh

ci-ios-typecheck:
	@./scripts/ci/ios-swift-typecheck.sh

ci-ios-contract-smoke:
	@node ./scripts/ci/ios-contract-smoke.mjs

ci-release-artifacts-smoke:
	@./scripts/ci/release-artifacts-smoke.sh

ci-platform-matrix-smoke:
	@./scripts/ci/platform-matrix-smoke.sh
