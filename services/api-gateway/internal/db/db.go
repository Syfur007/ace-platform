package db

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func databaseURL() string {
	url := os.Getenv("DATABASE_URL")
	if url != "" {
		return url
	}

	// Dev-friendly default inside docker compose: talk to the `db` service.
	return "postgres://ace:ace@db:5432/ace?sslmode=disable"
}

func Connect(ctx context.Context) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL())
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}

	// Keep defaults conservative for now.
	cfg.MaxConns = 10
	cfg.MinConns = 0
	cfg.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}

	return pool, nil
}

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	// Idempotent schema init (MVP). Replace with a real migrations tool later.
	statements := []string{
		`create table if not exists users (
			id text primary key,
			email text not null unique,
			password_hash text not null,
			created_at timestamptz not null default now()
		);`,
		`create table if not exists practice_sessions (
			id text primary key,
			user_id text not null references users(id) on delete cascade,
			package_id text null,
			is_timed boolean not null,
			target_count integer not null,
			current_index integer not null default 0,
			correct_count integer not null default 0,
			status text not null,
			question_order jsonb not null,
			created_at timestamptz not null default now()
		);`,
		`create table if not exists practice_answers (
			id bigserial primary key,
			session_id text not null references practice_sessions(id) on delete cascade,
			user_id text not null references users(id) on delete cascade,
			question_id text not null,
			choice_id text not null,
			correct boolean not null,
			explanation text not null,
			ts timestamptz not null default now()
		);`,
	}

	for _, stmt := range statements {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return err
		}
	}

	return nil
}
