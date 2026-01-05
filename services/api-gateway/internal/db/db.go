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
		// UUID support (for exam package IDs)
		`create extension if not exists pgcrypto;`,
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

		// Exam packages + enrollments (domain model)
		`create table if not exists exam_packages (
			id uuid primary key default gen_random_uuid(),
			code text not null,
			name text not null,
			subtitle text null,
			overview text null,
			modules jsonb not null default '[]'::jsonb,
			highlights jsonb not null default '[]'::jsonb,
			module_sections jsonb not null default '[]'::jsonb,
			is_hidden boolean not null default false,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			unique (code),
			unique (name)
		);`,
		`alter table exam_packages add column if not exists code text;`,
		`alter table exam_packages add column if not exists subtitle text null;`,
		`alter table exam_packages add column if not exists overview text null;`,
		`alter table exam_packages add column if not exists modules jsonb not null default '[]'::jsonb;`,
		`alter table exam_packages add column if not exists highlights jsonb not null default '[]'::jsonb;`,
		`alter table exam_packages add column if not exists module_sections jsonb not null default '[]'::jsonb;`,
		// Migration safety: older dev DBs may have exam_packages.id as text.
		// Convert it to uuid and remap dependent references before adding any new FKs.
		`do $$
		declare
			id_type text;
			r record;
		begin
			select data_type into id_type
			from information_schema.columns
			where table_schema='public' and table_name='exam_packages' and column_name='id';

			if id_type is not null and id_type <> 'uuid' then
				-- Ensure code exists and is populated (legacy: id was often 'gre', 'sat', etc.).
				if not exists (
					select 1 from information_schema.columns
					where table_schema='public' and table_name='exam_packages' and column_name='code'
				) then
					alter table exam_packages add column code text;
				end if;

				update exam_packages
				set code = coalesce(nullif(code, ''), nullif(id::text, ''), lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')))
				where code is null or code = '';

				-- Create a new uuid column and backfill.
				if not exists (
					select 1 from information_schema.columns
					where table_schema='public' and table_name='exam_packages' and column_name='id_new'
				) then
					alter table exam_packages add column id_new uuid;
				end if;

				update exam_packages
				set id_new = case
					when id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then id::uuid
					else gen_random_uuid()
				end
				where id_new is null;

				-- Drop all dependent foreign keys referencing exam_packages (names can vary across dev DBs).
				for r in (
					select conrelid::regclass as table_name, conname
					from pg_constraint
					where contype='f' and confrelid='public.exam_packages'::regclass
				) loop
					execute format('alter table %s drop constraint if exists %I', r.table_name, r.conname);
				end loop;

				-- Remap any legacy references to the new UUIDs (stored as text for now; later casts handle the type).
				if to_regclass('public.user_exam_package_enrollments') is not null then
					update user_exam_package_enrollments e
					set exam_package_id = ep.id_new::text
					from exam_packages ep
					where e.exam_package_id is not null
						and (e.exam_package_id::text = ep.code or e.exam_package_id::text = ep.id::text);
				end if;
				if to_regclass('public.practice_sessions') is not null then
					update practice_sessions ps
					set package_id = ep.id_new::text
					from exam_packages ep
					where ps.package_id is not null
						and (ps.package_id::text = ep.code or ps.package_id::text = ep.id::text);
				end if;

				-- Swap primary key column.
				alter table exam_packages drop constraint if exists exam_packages_pkey;
				alter table exam_packages drop column id;
				alter table exam_packages rename column id_new to id;
				alter table exam_packages add primary key (id);
			end if;
		end $$;`,
		`create unique index if not exists idx_exam_packages_code_unique on exam_packages(code);`,
		`do $$ begin
			-- Ensure code is non-null for existing rows.
			update exam_packages set code=lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) where code is null;
		end $$;`,
		`alter table exam_packages alter column code set not null;`,
		`create index if not exists idx_exam_packages_hidden on exam_packages(is_hidden);`,

		// Exam package tiers (policy containers)
		`create table if not exists exam_package_tiers (
			id uuid primary key default gen_random_uuid(),
			exam_package_id uuid not null references exam_packages(id) on delete cascade,
			code text not null,
			name text not null,
			sort_order integer not null default 0,
			is_default boolean not null default false,
			is_active boolean not null default true,
			policy jsonb not null default '{}'::jsonb,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			unique (exam_package_id, code)
		);`,
		`create index if not exists idx_exam_package_tiers_pkg on exam_package_tiers(exam_package_id, sort_order);`,
		`create index if not exists idx_exam_package_tiers_default on exam_package_tiers(exam_package_id, is_default);`,
		`create index if not exists idx_exam_package_tiers_active on exam_package_tiers(exam_package_id, is_active);`,

		`create table if not exists user_exam_package_enrollments (
			user_id text not null references users(id) on delete cascade,
			exam_package_id uuid not null references exam_packages(id) on delete restrict,
			tier_id uuid null references exam_package_tiers(id) on delete restrict,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			primary key (user_id, exam_package_id)
		);`,
		`alter table user_exam_package_enrollments add column if not exists tier_id uuid null;`,
		`alter table user_exam_package_enrollments add column if not exists updated_at timestamptz not null default now();`,
		`create index if not exists idx_user_exam_package_enrollments_pkg on user_exam_package_enrollments(exam_package_id);`,
		`create index if not exists idx_user_exam_package_enrollments_tier on user_exam_package_enrollments(tier_id);`,

		// Enrollment tier history (immutable events)
		`create table if not exists user_exam_package_enrollment_events (
			id bigserial primary key,
			user_id text not null references users(id) on delete cascade,
			exam_package_id uuid not null references exam_packages(id) on delete cascade,
			from_tier_id uuid null references exam_package_tiers(id) on delete restrict,
			to_tier_id uuid not null references exam_package_tiers(id) on delete restrict,
			changed_at timestamptz not null default now(),
			changed_by_user_id text null references users(id) on delete set null,
			reason text not null default '',
			metadata jsonb not null default '{}'::jsonb
		);`,
		`create index if not exists idx_enrollment_events_user_pkg on user_exam_package_enrollment_events(user_id, exam_package_id, id desc);`,
		`create index if not exists idx_enrollment_events_changed_at on user_exam_package_enrollment_events(changed_at desc);`,

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

		// Optional: session limit groups (used to cap active devices/sessions by group membership)
		`create table if not exists auth_session_groups (
			id text primary key,
			name text not null unique,
			created_at timestamptz not null default now()
		);`,
		`create table if not exists auth_session_group_memberships (
			group_id text not null references auth_session_groups(id) on delete cascade,
			user_id text not null references users(id) on delete cascade,
			created_at timestamptz not null default now(),
			primary key (group_id, user_id)
		);`,
		`create index if not exists idx_auth_session_group_memberships_user on auth_session_group_memberships(user_id);`,
		`create table if not exists auth_session_limits_group (
			group_id text primary key references auth_session_groups(id) on delete cascade,
			max_active_sessions integer not null
		);`,

		// Practice test templates (catalog items configured by admin/instructors)
		`create table if not exists practice_test_templates (
			id uuid primary key default gen_random_uuid(),
			exam_package_id uuid not null references exam_packages(id) on delete cascade,
			name text not null,
			section text not null,
			topic_id text null references question_bank_topics(id) on delete set null,
			difficulty_id text null references question_bank_difficulties(id) on delete set null,
			is_timed boolean not null default false,
			target_count integer not null,
			sort_order integer not null default 0,
			is_published boolean not null default false,
			created_by_user_id text not null references users(id) on delete restrict,
			updated_by_user_id text not null references users(id) on delete restrict,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now()
		);`,
		`create index if not exists idx_practice_test_templates_pkg_pub on practice_test_templates(exam_package_id, is_published, sort_order, created_at desc);`,
		`create index if not exists idx_practice_test_templates_pkg_section on practice_test_templates(exam_package_id, section, sort_order);`,
		`create index if not exists idx_practice_test_templates_topic on practice_test_templates(topic_id);`,
		`create index if not exists idx_practice_test_templates_difficulty on practice_test_templates(difficulty_id);`,
		`create table if not exists practice_sessions (
			id text primary key,
			user_id text not null references users(id) on delete cascade,
			package_id uuid null,
			tier_id uuid null,
			template_id uuid null,
			is_timed boolean not null,
			started_at timestamptz not null default now(),
			time_limit_seconds integer not null default 0,
			target_count integer not null,
			current_index integer not null default 0,
			current_question_started_at timestamptz not null default now(),
			question_timings jsonb not null default '{}'::jsonb,
			questions_snapshot jsonb not null default '[]'::jsonb,
			correct_count integer not null default 0,
			status text not null,
			paused_at timestamptz null,
			question_order jsonb not null,
			created_at timestamptz not null default now(),
			last_activity_at timestamptz not null default now()
		);`,
		`alter table practice_sessions add column if not exists template_id uuid null;`,
		`alter table practice_sessions add column if not exists tier_id uuid null;`,
		`alter table practice_sessions add column if not exists last_activity_at timestamptz not null default now();`,
		`alter table practice_sessions add column if not exists started_at timestamptz not null default now();`,
		`alter table practice_sessions add column if not exists time_limit_seconds integer not null default 0;`,
		`alter table practice_sessions add column if not exists current_question_started_at timestamptz not null default now();`,
		`alter table practice_sessions add column if not exists question_timings jsonb not null default '{}'::jsonb;`,
		`alter table practice_sessions add column if not exists questions_snapshot jsonb not null default '[]'::jsonb;`,
		`alter table practice_sessions add column if not exists paused_at timestamptz null;`,
		`create index if not exists idx_practice_sessions_template_id on practice_sessions(template_id);`,
		`create index if not exists idx_practice_sessions_tier_id on practice_sessions(tier_id);`,
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
			exam_package_id uuid null,
			tier_id uuid null,
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
		`alter table exam_sessions add column if not exists exam_package_id uuid null;`,
		`alter table exam_sessions add column if not exists tier_id uuid null;`,
		`alter table exam_sessions add column if not exists submitted_at timestamptz null;`,
		`alter table exam_sessions add column if not exists terminated_at timestamptz null;`,
		`alter table exam_sessions add column if not exists terminated_by_user_id text null references users(id) on delete set null;`,
		`alter table exam_sessions add column if not exists termination_reason text not null default '';`,
		`alter table exam_sessions add column if not exists invalidated_at timestamptz null;`,
		`alter table exam_sessions add column if not exists invalidated_by_user_id text null references users(id) on delete set null;`,
		`alter table exam_sessions add column if not exists invalidation_reason text not null default '';`,
		`create index if not exists idx_exam_sessions_last_heartbeat on exam_sessions(last_heartbeat_at desc);`,
		`create index if not exists idx_exam_sessions_status on exam_sessions(status);`,
		`create index if not exists idx_exam_sessions_exam_package_id on exam_sessions(exam_package_id);`,
		`create index if not exists idx_exam_sessions_tier_id on exam_sessions(tier_id);`,

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
			-- Legacy: previously referenced exam packages by a string id (e.g. 'gre').
			-- Kept for migration safety / backfill into exam_package_question_bank_packages.
			exam_package_id text null,
			created_by_user_id text not null references users(id) on delete restrict,
			is_hidden boolean not null default false,
			created_at timestamptz not null default now()
		);`,
		`alter table question_bank_packages add column if not exists exam_package_id text null;`,
		`create index if not exists idx_question_bank_packages_exam_package_id on question_bank_packages(exam_package_id);`,
		`alter table question_bank_packages add column if not exists created_by_user_id text not null references users(id) on delete restrict;`,
		`alter table question_bank_packages add column if not exists is_hidden boolean not null default false;`,
		`alter table question_bank_packages add column if not exists updated_at timestamptz not null default now();`,

		// Exam package → question bank packages mapping (allows 1:N or N:N)
		`create table if not exists exam_package_question_bank_packages (
			exam_package_id uuid not null references exam_packages(id) on delete cascade,
			question_bank_package_id text not null references question_bank_packages(id) on delete cascade,
			created_at timestamptz not null default now(),
			primary key (exam_package_id, question_bank_package_id)
		);`,
		`create index if not exists idx_exam_pkg_qbp_qbp on exam_package_question_bank_packages(question_bank_package_id);`,

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

	// Seed exam packages (idempotent).
	// - id is generated UUID
	// - code is a stable identifier used for legacy backfill (e.g. old question banks stored 'gre')
	_, _ = pool.Exec(ctx, `insert into exam_packages (code, name) values
		('gre', 'GRE'),
		('ielts', 'IELTS'),
		('sat', 'SAT')
		on conflict (code) do update set name=excluded.name`)

	// Seed a default tier per exam package (idempotent).
	// This is required to support tier-based enrollments and to backfill existing enrollments.
	_, _ = pool.Exec(ctx, `insert into exam_package_tiers (exam_package_id, code, name, sort_order, is_default)
		select id, 'default', 'Default', 0, true
		from exam_packages
		on conflict (exam_package_id, code) do nothing`)

	// Ensure all existing enrollments have a tier (idempotent backfill).
	_, _ = pool.Exec(ctx, `update user_exam_package_enrollments e
		set tier_id = t.id,
			updated_at = now()
		from exam_package_tiers t
		where e.tier_id is null
			and t.exam_package_id = e.exam_package_id
			and t.is_default = true`)

	// Backfill mapping from legacy question_bank_packages.exam_package_id (idempotent).
	// Legacy value matches exam_packages.code.
	_, _ = pool.Exec(ctx, `insert into exam_package_question_bank_packages (exam_package_id, question_bank_package_id)
		select ep.id, qbp.id
		from question_bank_packages qbp
		join exam_packages ep on ep.code = qbp.exam_package_id
		where qbp.exam_package_id is not null and qbp.exam_package_id <> ''
		on conflict (exam_package_id, question_bank_package_id) do nothing`)

	// Normalize legacy package IDs:
	// - user_exam_package_enrollments.exam_package_id: text -> uuid
	// - practice_sessions.package_id: text -> uuid
	// Some older dev DBs have constraints that prevent ALTER TYPE, so we drop/recreate them.
	_, _ = pool.Exec(ctx, `do $$
	declare
		enroll_type text;
		sess_type text;
		def text;
	begin
		-- Drop constraints that would block type changes.
		if to_regclass('public.practice_sessions') is not null then
			alter table practice_sessions drop constraint if exists fk_practice_sessions_enrollment;
			alter table practice_sessions drop constraint if exists fk_practice_sessions_exam_package;
		end if;

		-- Convert enrollments.exam_package_id to uuid.
		if to_regclass('public.user_exam_package_enrollments') is not null then
			select data_type into enroll_type
			from information_schema.columns
			where table_schema='public' and table_name='user_exam_package_enrollments' and column_name='exam_package_id';

			if enroll_type is not null and enroll_type <> 'uuid' then
				-- Map legacy codes to UUIDs (store as text so we can cast).
				update user_exam_package_enrollments e
				set exam_package_id = ep.id::text
				from exam_packages ep
				where e.exam_package_id is not null and e.exam_package_id::text = ep.code;

				-- Drop rows that still don't map cleanly.
				delete from user_exam_package_enrollments
				where exam_package_id is not null
					and exam_package_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

				alter table user_exam_package_enrollments drop constraint if exists user_exam_package_enrollments_pkey;
				alter table user_exam_package_enrollments alter column exam_package_id type uuid using exam_package_id::uuid;
				alter table user_exam_package_enrollments add primary key (user_id, exam_package_id);
			end if;
		end if;

		-- Convert practice_sessions.package_id to uuid.
		if to_regclass('public.practice_sessions') is not null then
			select data_type into sess_type
			from information_schema.columns
			where table_schema='public' and table_name='practice_sessions' and column_name='package_id';

			if sess_type is not null and sess_type <> 'uuid' then
				-- Map legacy codes to UUIDs (store as text so we can cast).
				update practice_sessions ps
				set package_id = ep.id::text
				from exam_packages ep
				where ps.package_id is not null and ps.package_id::text = ep.code;

				-- Null out obviously-non-UUID values before attempting a type change.
				update practice_sessions
				set package_id=null
				where package_id is not null
					and package_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

				alter table practice_sessions alter column package_id type uuid using package_id::uuid;
			end if;
		end if;

		-- Ensure enrollments have an FK to exam_packages.
		if to_regclass('public.user_exam_package_enrollments') is not null then
			if not exists (
				select 1
				from pg_constraint
				where conrelid='public.user_exam_package_enrollments'::regclass
					and contype='f'
					and confrelid='public.exam_packages'::regclass
			) then
				begin
					alter table user_exam_package_enrollments
						add constraint fk_user_exam_package_enrollments_exam_package
						foreign key (exam_package_id) references exam_packages(id) on delete restrict;
				exception when others then
					-- Ignore if the constraint exists under another name.
				end;
			end if;
		end if;

		-- Re-add practice session FKs (and keep unenroll working by cascading dependent sessions).
		if to_regclass('public.practice_sessions') is not null then
			begin
				alter table practice_sessions
					add constraint fk_practice_sessions_exam_package
					foreign key (package_id) references exam_packages(id) on delete set null;
			exception when others then
				-- Ignore if exists.
			end;

			select pg_get_constraintdef(oid) into def
			from pg_constraint
			where conname='fk_practice_sessions_enrollment'
				and conrelid='public.practice_sessions'::regclass;

			if def is null then
				alter table practice_sessions
					add constraint fk_practice_sessions_enrollment
					foreign key (user_id, package_id)
					references user_exam_package_enrollments(user_id, exam_package_id)
					on delete cascade;
			elsif position('ON DELETE CASCADE' in upper(def)) = 0 then
				alter table practice_sessions drop constraint if exists fk_practice_sessions_enrollment;
				alter table practice_sessions
					add constraint fk_practice_sessions_enrollment
					foreign key (user_id, package_id)
					references user_exam_package_enrollments(user_id, exam_package_id)
					on delete cascade;
			end if;
		end if;
	end $$;`)


	// Cleanup (best-effort, safe after normalization)
	_, _ = pool.Exec(ctx, `update practice_sessions set package_id=null where package_id is not null and package_id not in (select id from exam_packages)`)
	_, _ = pool.Exec(ctx, `update practice_sessions ps set package_id=null where package_id is not null and not exists (
		select 1 from user_exam_package_enrollments e where e.user_id=ps.user_id and e.exam_package_id=ps.package_id
	)`)

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
