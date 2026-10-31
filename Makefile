.PHONY: install dev-api dev-web dev-mock test lint build docker audit
install:    ## install both toolchains
	cd api && uv sync
	cd web && pnpm install
dev-api:    ## API on :8000 (needs ANTHROPIC_API_KEY in .env, otherwise chat is offline)
	cd api && uv run uvicorn app.main:app --reload
dev-mock:   ## API on :8000 with the scripted mock LLM (no key needed; dev only)
	cd api && MOCK_LLM=true uv run uvicorn app.main:app --reload
dev-web:    ## frontend on :5173 (proxies /api to :8000)
	cd web && pnpm dev
test:       ## everything: lint + types + unit tests
	cd api && uv run ruff check . && uv run pytest -q
	cd web && pnpm typecheck && pnpm test
build:
	cd web && pnpm build
docker:
	docker compose up --build
audit:      ## accessibility + overflow audit and perf measurements (needs `pnpm build && pnpm preview` running, and Playwright)
	cd web && pnpm audit:ui && pnpm audit:perf
