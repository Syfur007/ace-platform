package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"encoding/json"
	"github.com/ace-platform/apps/backend/internal/bootstrap"
	"github.com/ace-platform/apps/backend/internal/db"
	"github.com/ace-platform/apps/backend/internal/handlers"
	pack "github.com/ace-platform/apps/backend/internal/handlers/exampackage"
	dom "github.com/ace-platform/apps/backend/internal/domain/exampackage"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	pool, err := db.Connect(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	if err := bootstrap.UsersFromEnv(context.Background(), pool); err != nil {
		log.Fatal(err)
	}

	r := gin.New()
	r.Use(gin.Recovery())

	// Minimal CORS for local dev: web runs on localhost:5173 and API on localhost:8080.
	// This keeps the gateway usable from the browser without requiring extra deps.
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowed := os.Getenv("CORS_ORIGINS")
		if strings.TrimSpace(allowed) == "" {
			allowed = "http://localhost:5173"
		}
		allowedList := strings.Split(allowed, ",")
		originAllowed := false
		for _, raw := range allowedList {
			v := strings.TrimSpace(raw)
			if v != "" && strings.EqualFold(v, origin) {
				originAllowed = true
				break
			}
		}

		h := c.Writer.Header()
		if origin != "" && originAllowed {
			h.Set("Access-Control-Allow-Origin", origin)
			h.Add("Vary", "Origin")
		}
		h.Set("Access-Control-Allow-Credentials", "true")
		h.Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type,Accept,Authorization,X-CSRF-Token")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Double-submit CSRF protection for cookie auth.
	// - For unsafe methods, require X-CSRF-Token to match the ace_csrf cookie.
	// - Exempt login/register endpoints (they mint the CSRF cookie).
	r.Use(func(c *gin.Context) {
		m := c.Request.Method
		if m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions {
			c.Next()
			return
		}
		p := c.Request.URL.Path
		if strings.HasSuffix(p, "/auth/login") || strings.HasSuffix(p, "/auth/register") {
			c.Next()
			return
		}
		csrfCookie, err := c.Cookie("ace_csrf")
		csrfHeader := strings.TrimSpace(c.GetHeader("X-CSRF-Token"))
		if err != nil || strings.TrimSpace(csrfCookie) == "" || csrfHeader == "" || csrfHeader != strings.TrimSpace(csrfCookie) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "csrf"})
			return
		}
		c.Next()
	})

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"ts":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	handlers.RegisterAuthRoutes(r, pool)

	// Wire exam package domain: repository -> service -> handlers
	repo := dom.NewPostgresRepository(pool)
	auditFn := func(ctx context.Context, actorUserID, actorRole, action, targetType, targetID string, metadata any) {
		payload := []byte("{}")
		if metadata != nil {
			if b, err := json.Marshal(metadata); err == nil {
				payload = b
			}
		}
		_, _ = pool.Exec(ctx, `insert into audit_log (actor_user_id, actor_role, action, target_type, target_id, metadata) values ($1,$2,$3,$4,$5,$6)`, actorUserID, actorRole, action, targetType, targetID, payload)
	}
	svc := dom.NewService(repo, auditFn)

	// Register the new exam package handlers (preserve existing endpoints)
	pack.RegisterPublicRoutes(r, svc)
	pack.RegisterStudentRoutes(r, svc, pool)
	pack.RegisterInstructorRoutes(r, svc, pool)

	handlers.RegisterPracticeRoutes(r, pool)
	handlers.RegisterExamRoutes(r, pool)
	handlers.RegisterQuestionRoutes(r, pool)
	handlers.RegisterAdminRoutes(r, pool)

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
