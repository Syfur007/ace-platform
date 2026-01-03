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
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			deleted_at timestamptz null
		);`,
		`alter table users add column if not exists role text not null default 'student';`,
		`alter table users add column if not exists updated_at timestamptz not null default now();`,
		`alter table users add column if not exists deleted_at timestamptz null;`,
		`create index if not exists idx_users_role on users(role);`,
		`create index if not exists idx_users_deleted_at on users(deleted_at);`,

		// Auth sessions + refresh tokens (cookie-based auth)
		`create table if not exists auth_sessions (
			id text primary key,
			user_id text not null references users(id) on delete cascade,
			role text not null,
			audience text not null,
			ip text not null default '',
			user_agent text not null default '',
			created_at timestamptz not null default now(),
			last_seen_at timestamptz not null default now(),
			expires_at timestamptz not null,
			revoked_at timestamptz null,
			revoked_reason text not null default ''
		);`,
		`create index if not exists idx_auth_sessions_user_created on auth_sessions(user_id, created_at desc);`,
		`create index if not exists idx_auth_sessions_user_active on auth_sessions(user_id, revoked_at, expires_at);`,

		`create table if not exists auth_refresh_tokens (
			id text primary key,
			session_id text not null references auth_sessions(id) on delete cascade,
			token_hash bytea not null,
			created_at timestamptz not null default now(),
			expires_at timestamptz not null,
			revoked_at timestamptz null,
			replaced_by_token_id text null
		);`,
		`create unique index if not exists idx_auth_refresh_tokens_hash on auth_refresh_tokens(token_hash);`,
		`create index if not exists idx_auth_refresh_tokens_session_created on auth_refresh_tokens(session_id, created_at desc);`,

		`create table if not exists auth_session_limits_role (
			role text primary key,
			max_active_sessions integer not null
		);`,
		`create table if not exists auth_session_limits_user (
			user_id text primary key references users(id) on delete cascade,
			max_active_sessions integer not null
		);`,
		`create table if not exists practice_sessions (
			id text primary key,
			user_id text not null references users(id) on delete cascade,
			package_id text null,
			is_timed boolean not null,
			started_at timestamptz not null default now(),
			time_limit_seconds integer not null default 0,
			target_count integer not null,
			current_index integer not null default 0,
			current_question_started_at timestamptz not null default now(),
			question_timings jsonb not null default '{}'::jsonb,
			correct_count integer not null default 0,
			status text not null,
			paused_at timestamptz null,
			question_order jsonb not null,
			created_at timestamptz not null default now(),
			last_activity_at timestamptz not null default now()
		);`,
		`alter table practice_sessions add column if not exists last_activity_at timestamptz not null default now();`,
		`alter table practice_sessions add column if not exists started_at timestamptz not null default now();`,
		`alter table practice_sessions add column if not exists time_limit_seconds integer not null default 0;`,
		`alter table practice_sessions add column if not exists current_question_started_at timestamptz not null default now();`,
		`alter table practice_sessions add column if not exists question_timings jsonb not null default '{}'::jsonb;`,
		`alter table practice_sessions add column if not exists paused_at timestamptz null;`,
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
			submitted_at timestamptz null,
			terminated_at timestamptz null,
			terminated_by_user_id text null references users(id) on delete set null,
			termination_reason text not null default '',
			invalidated_at timestamptz null,
			invalidated_by_user_id text null references users(id) on delete set null,
			invalidation_reason text not null default '',
			primary key (user_id, id)
		);`,
		`alter table exam_sessions add column if not exists submitted_at timestamptz null;`,
		`alter table exam_sessions add column if not exists terminated_at timestamptz null;`,
		`alter table exam_sessions add column if not exists terminated_by_user_id text null references users(id) on delete set null;`,
		`alter table exam_sessions add column if not exists termination_reason text not null default '';`,
		`alter table exam_sessions add column if not exists invalidated_at timestamptz null;`,
		`alter table exam_sessions add column if not exists invalidated_by_user_id text null references users(id) on delete set null;`,
		`alter table exam_sessions add column if not exists invalidation_reason text not null default '';`,
		`create index if not exists idx_exam_sessions_last_heartbeat on exam_sessions(last_heartbeat_at desc);`,
		`create index if not exists idx_exam_sessions_status on exam_sessions(status);`,

		`create table if not exists exam_session_events (
			id bigserial primary key,
			user_id text not null,
			session_id text not null,
			event_type text not null,
			payload jsonb not null default '{}'::jsonb,
			created_at timestamptz not null default now(),
			foreign key (user_id, session_id) references exam_sessions(user_id, id) on delete cascade
		);`,
		`create index if not exists idx_exam_session_events_user_session on exam_session_events(user_id, session_id, id desc);`,
		`create index if not exists idx_exam_session_events_type on exam_session_events(event_type);`,

		`create table if not exists exam_session_flags (
			id bigserial primary key,
			user_id text not null,
			session_id text not null,
			flag_type text not null,
			note text not null default '',
			created_by_user_id text not null references users(id) on delete restrict,
			created_at timestamptz not null default now(),
			foreign key (user_id, session_id) references exam_sessions(user_id, id) on delete cascade
		);`,
		`create index if not exists idx_exam_session_flags_user_session on exam_session_flags(user_id, session_id, id desc);`,

		`create table if not exists audit_log (
			id bigserial primary key,
			actor_user_id text null references users(id) on delete set null,
			actor_role text not null default '',
			action text not null,
			target_type text not null,
			target_id text not null,
			metadata jsonb not null default '{}'::jsonb,
			created_at timestamptz not null default now()
		);`,
		`create index if not exists idx_audit_log_target on audit_log(target_type, target_id, id desc);`,
		`create index if not exists idx_audit_log_actor on audit_log(actor_user_id, id desc);`,

		// Normalized question bank (MVP)
		`create table if not exists question_bank_packages (
			id text primary key,
			name text not null unique,
			created_by_user_id text not null references users(id) on delete restrict,
			is_hidden boolean not null default false,
			created_at timestamptz not null default now()
		);`,
		`alter table question_bank_packages add column if not exists created_by_user_id text not null references users(id) on delete restrict;`,
		`alter table question_bank_packages add column if not exists is_hidden boolean not null default false;`,
		`alter table question_bank_packages add column if not exists updated_at timestamptz not null default now();`,

		`create table if not exists question_bank_topics (
			id text primary key,
			package_id text null references question_bank_packages(id) on delete set null,
			name text not null,
			created_by_user_id text not null references users(id) on delete restrict,
			is_hidden boolean not null default false,
			created_at timestamptz not null default now(),
			unique (package_id, name)
		);`,
		`alter table question_bank_topics add column if not exists created_by_user_id text not null references users(id) on delete restrict;`,
		`alter table question_bank_topics add column if not exists is_hidden boolean not null default false;`,
		`alter table question_bank_topics add column if not exists updated_at timestamptz not null default now();`,
		`create index if not exists idx_question_bank_topics_package_id on question_bank_topics(package_id);`,

		`create table if not exists question_bank_difficulties (
			id text primary key,
			display_name text not null,
			sort_order integer not null
		);`,

		`create table if not exists question_bank_questions (
			id text primary key,
			package_id text null references question_bank_packages(id) on delete set null,
			topic_id text null references question_bank_topics(id) on delete set null,
			difficulty_id text not null references question_bank_difficulties(id) on delete restrict,
			prompt text not null,
			explanation_text text not null default '',
			review_note text not null default '',
			status text not null default 'draft',
			created_by_user_id text not null references users(id) on delete restrict,
			updated_by_user_id text not null references users(id) on delete restrict,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now()
		);`,
		`alter table question_bank_questions add column if not exists review_note text not null default '';`,
		`create index if not exists idx_question_bank_questions_status on question_bank_questions(status);`,
		`create index if not exists idx_question_bank_questions_package on question_bank_questions(package_id);`,
		`create index if not exists idx_question_bank_questions_topic on question_bank_questions(topic_id);`,
		`create index if not exists idx_question_bank_questions_difficulty on question_bank_questions(difficulty_id);`,
		`create index if not exists idx_question_bank_questions_status_updated_at on question_bank_questions(status, updated_at desc);`,

		`create table if not exists question_bank_choices (
			id text primary key,
			question_id text not null references question_bank_questions(id) on delete cascade,
			order_index integer not null,
			text text not null,
			unique (question_id, order_index)
		);`,
		`create index if not exists idx_question_bank_choices_question_id on question_bank_choices(question_id);`,

		`create table if not exists question_bank_correct_choice (
			question_id text primary key references question_bank_questions(id) on delete cascade,
			choice_id text not null references question_bank_choices(id) on delete cascade
		);`,
	}

	for _, stmt := range statements {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return err
		}
	}

	// Seed difficulties (idempotent)
	_, _ = pool.Exec(ctx, `insert into question_bank_difficulties (id, display_name, sort_order) values
		('easy', 'Easy', 1),
		('medium', 'Medium', 2),
		('hard', 'Hard', 3)
		on conflict (id) do nothing`)

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
