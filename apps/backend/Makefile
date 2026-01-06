# Makefile for apps/backend
.PHONY: build test fmt tidy lint migrate-up migrate-down migrate-status docker-build

build:
	go build -v ./cmd/api

test:
	go test ./... -v

fmt:
	gofmt -w .

tidy:
	go mod tidy

lint:
	golangci-lint run ./...

migrate-up:
	go run ./cmd/migrate --database "${DATABASE_URL}" --path ./infrastructure/database/migrations up

migrate-down:
	go run ./cmd/migrate --database "${DATABASE_URL}" --path ./infrastructure/database/migrations down

migrate-status:
	go run ./cmd/migrate --database "${DATABASE_URL}" --path ./infrastructure/database/migrations status

docker-build:
	docker build -t ace-platform/backend:latest -f Dockerfile .
