install:
	docker run --rm -v "$(CURDIR):/work" -w /work/apps/web node:24-alpine sh -c "npm install"
	docker run --rm -v "$(CURDIR):/work" -w /work/services/api-gateway golang:1.24-alpine sh -c "go mod tidy"

dev-web:
	docker run --rm -p 5173:5173 -v "$(CURDIR):/work" -w /work/apps/web node:24-alpine sh -c "npm install && npm run dev -- --host 0.0.0.0 --port 5173"

dev-api:
	docker run --rm -p 8080:8080 -v "$(CURDIR):/work" -w /work/services/api-gateway golang:1.24-alpine sh -c "go run ./cmd/api-gateway"
