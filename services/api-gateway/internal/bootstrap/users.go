package bootstrap

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
	"github.com/ace-platform/api-gateway/internal/util"
)

func UsersFromEnv(ctx context.Context, pool *pgxpool.Pool) error {
	if err := userFromEnv(ctx, pool, "admin", "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD"); err != nil {
		return err
	}
	if err := userFromEnv(ctx, pool, "instructor", "BOOTSTRAP_INSTRUCTOR_EMAIL", "BOOTSTRAP_INSTRUCTOR_PASSWORD"); err != nil {
		return err
	}
	return nil
}

func userFromEnv(ctx context.Context, pool *pgxpool.Pool, role string, emailKey string, passwordKey string) error {
	email := strings.TrimSpace(strings.ToLower(os.Getenv(emailKey)))
	password := os.Getenv(passwordKey)
	if email == "" || password == "" {
		return nil
	}

	var existingRole string
	err := pool.QueryRow(ctx, `select role from users where email=$1`, email).Scan(&existingRole)
	if err == nil {
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
