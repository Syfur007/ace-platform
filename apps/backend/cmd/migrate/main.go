package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/apps/backend/internal/db"
)

func main() {
	log.SetFlags(0)

	database := flag.String("database", db.DatabaseURL(), "Postgres database URL")
	path := flag.String("path", "./migrations", "Path to migration files")
	steps := flag.Int("steps", 0, "Number of steps to apply (default 0 = all the way)")
	force := flag.Int("force", -1, "Force schema_migrations version (dangerous; does not run SQL)")
	flag.Parse()

	cmd := ""
	if flag.NArg() > 0 {
		cmd = strings.ToLower(strings.TrimSpace(flag.Arg(0)))
	}
	if cmd == "" {
		usageAndExit("missing command (up|down|status|force)")
	}

	absPath, err := filepath.Abs(*path)
	if err != nil {
		log.Fatalf("resolve --path: %v", err)
	}
	// golang-migrate expects a file:// URL.
	// On Windows, absolute paths must be in URL form: file:///C:/...
	sourceURL := "file:///" + strings.TrimPrefix(filepath.ToSlash(absPath), "/")

	m, err := migrate.New(sourceURL, *database)
	if err != nil {
		log.Fatalf("migrate init: %v", err)
	}
	defer func() {
		srcErr, dbErr := m.Close()
		if srcErr != nil {
			log.Printf("migrate close source: %v", srcErr)
		}
		if dbErr != nil {
			log.Printf("migrate close db: %v", dbErr)
		}
	}()

	switch cmd {
	case "status":
		printStatus(*database)
		return

	case "force":
		if *force < 0 {
			usageAndExit("--force is required for force")
		}
		if err := m.Force(*force); err != nil {
			log.Fatalf("force %d: %v", *force, err)
		}
		log.Printf("forced schema_migrations to version=%d", *force)
		printStatus(*database)
		return

	case "up":
		start := time.Now()
		if *steps != 0 {
			log.Printf("migrating up steps=%d ...", *steps)
			err = m.Steps(*steps)
		} else {
			log.Printf("migrating up ...")
			err = m.Up()
		}
		handleMigrateResult(err)
		log.Printf("done in %s", time.Since(start).Round(time.Millisecond))
		printStatus(*database)
		return

	case "down":
		start := time.Now()
		if *steps != 0 {
			log.Printf("migrating down steps=%d ...", *steps)
			err = m.Steps(-*steps)
		} else {
			log.Printf("migrating down ...")
			err = m.Down()
		}
		handleMigrateResult(err)
		log.Printf("done in %s", time.Since(start).Round(time.Millisecond))
		printStatus(*database)
		return

	default:
		usageAndExit(fmt.Sprintf("unknown command %q", cmd))
	}
}

func usageAndExit(msg string) {
	if msg != "" {
		fmt.Fprintln(os.Stderr, "error:", msg)
	}
	fmt.Fprintln(os.Stderr, "usage:")
	fmt.Fprintln(os.Stderr, "  migrate [--database URL] [--path ./migrations] [--steps N] up|down")
	fmt.Fprintln(os.Stderr, "  migrate [--database URL] [--path ./migrations] status")
	fmt.Fprintln(os.Stderr, "  migrate [--database URL] [--path ./migrations] --force N force")
	os.Exit(2)
}

func handleMigrateResult(err error) {
	if err == nil {
		return
	}
	if errors.Is(err, migrate.ErrNoChange) {
		log.Printf("no change")
		return
	}
	log.Fatalf("migrate error: %v", err)
}

func printStatus(databaseURL string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		log.Fatalf("status parse --database: %v", err)
	}
	cfg.MaxConns = 1
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatalf("status connect: %v", err)
	}
	defer pool.Close()

	var version int64
	var dirty bool
	err = pool.QueryRow(ctx, `select version, dirty from schema_migrations limit 1`).Scan(&version, &dirty)
	if err != nil {
		// If schema_migrations doesn't exist yet, treat as empty.
		log.Printf("status: no schema_migrations yet")
		return
	}

	log.Printf("status: version=%d dirty=%v", version, dirty)
}
