package db

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
	"github.com/ace-platform/api-gateway/internal/util"
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
			role text not null default 'student',
			created_at timestamptz not null default now()
		);`,
		`alter table users add column if not exists role text not null default 'student';`,
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
		`create table if not exists exam_sessions (
			user_id text not null references users(id) on delete cascade,
			id text not null,
			status text not null default 'active',
			snapshot jsonb not null default '{}'::jsonb,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			last_heartbeat_at timestamptz not null default now(),
			primary key (user_id, id)
		);`,
	}

	for _, stmt := range statements {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return err
		}
	}

	if err := bootstrapUserFromEnv(ctx, pool, "admin", "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD"); err != nil {
		return err
	}
	if err := bootstrapUserFromEnv(ctx, pool, "instructor", "BOOTSTRAP_INSTRUCTOR_EMAIL", "BOOTSTRAP_INSTRUCTOR_PASSWORD"); err != nil {
		return err
	}

	return nil
}

func bootstrapUserFromEnv(ctx context.Context, pool *pgxpool.Pool, role string, emailKey string, passwordKey string) error {
	email := strings.TrimSpace(strings.ToLower(os.Getenv(emailKey)))
	password := os.Getenv(passwordKey)
	if email == "" || password == "" {
		return nil
	}

	var existingRole string
	err := pool.QueryRow(ctx, `select role from users where email=$1`, email).Scan(&existingRole)
	if err == nil {
		// Email already exists. Only allow if it's the same role.
		if existingRole != role {
			return fmt.Errorf("bootstrap %s: email already exists with role %s", role, existingRole)
		}
		return nil
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("bootstrap %s: hash password: %w", role, err)
	}

	userID := util.NewID("usr")
	_, err = pool.Exec(ctx, `insert into users (id, email, password_hash, role) values ($1, $2, $3, $4)`, userID, email, hash, role)
	if err != nil {
		return fmt.Errorf("bootstrap %s: insert user: %w", role, err)
	}

	return nil
}
