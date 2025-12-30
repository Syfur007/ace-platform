package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
	"github.com/ace-platform/api-gateway/internal/util"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
}

type AuthResponse struct {
	AccessToken string       `json:"accessToken"`
	User        UserResponse `json:"user"`
}

const (
	roleStudent    = "student"
	roleInstructor = "instructor"
	roleAdmin      = "admin"
)

func handleRegister(r *gin.Engine, pool *pgxpool.Pool, path string, role string, audience string) {
	r.POST(path, func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}

		email := strings.TrimSpace(strings.ToLower(req.Email))
		if email == "" || req.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "email and password are required"})
			return
		}

		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to hash password"})
			return
		}

		userID := util.NewID("usr")
		ctx := context.Background()
		_, err = pool.Exec(ctx, `insert into users (id, email, password_hash, role) values ($1, $2, $3, $4)`, userID, email, hash, role)
		if err != nil {
			// cheap conflict detection
			c.JSON(http.StatusBadRequest, gin.H{"message": "user already exists or invalid"})
			return
		}

		var createdAt time.Time
		_ = pool.QueryRow(ctx, `select created_at from users where id=$1`, userID).Scan(&createdAt)

		token, err := auth.IssueAccessToken(userID, role, audience, 24*time.Hour)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue token"})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{
			AccessToken: token,
			User:        UserResponse{ID: userID, Email: email, Role: role, CreatedAt: createdAt.UTC().Format(time.RFC3339)},
		})
	})
}

func handleLogin(r *gin.Engine, pool *pgxpool.Pool, path string, role string, audience string) {
	r.POST(path, func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}

		email := strings.TrimSpace(strings.ToLower(req.Email))
		if email == "" || req.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "email and password are required"})
			return
		}

		ctx := context.Background()
		var userID string
		var passwordHash string
		var createdAt time.Time
		var storedRole string
		err := pool.QueryRow(ctx, `select id, password_hash, created_at, role from users where email=$1 and role=$2 and deleted_at is null`, email, role).
			Scan(&userID, &passwordHash, &createdAt, &storedRole)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid credentials"})
			return
		}

		if !auth.VerifyPassword(passwordHash, req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid credentials"})
			return
		}

		token, err := auth.IssueAccessToken(userID, storedRole, audience, 24*time.Hour)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue token"})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{
			AccessToken: token,
			User:        UserResponse{ID: userID, Email: email, Role: storedRole, CreatedAt: createdAt.UTC().Format(time.RFC3339)},
		})
	})
}

func handleMe(r *gin.Engine, pool *pgxpool.Pool, path string, role string, audience string) {
	r.GET(path, auth.RequirePortalAuth(role, audience), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		ctx := context.Background()
		var email string
		var createdAt time.Time
		var storedRole string
		err := pool.QueryRow(ctx, `select email, created_at, role from users where id=$1 and deleted_at is null`, userID).Scan(&email, &createdAt, &storedRole)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		c.JSON(http.StatusOK, UserResponse{ID: userID, Email: email, Role: storedRole, CreatedAt: createdAt.UTC().Format(time.RFC3339)})
	})
}

func RegisterAuthRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	// Portal-specific routes
	handleRegister(r, pool, "/student/auth/register", roleStudent, roleStudent)
	handleLogin(r, pool, "/student/auth/login", roleStudent, roleStudent)
	handleMe(r, pool, "/student/auth/me", roleStudent, roleStudent)

	handleLogin(r, pool, "/instructor/auth/login", roleInstructor, roleInstructor)
	handleMe(r, pool, "/instructor/auth/me", roleInstructor, roleInstructor)

	handleLogin(r, pool, "/admin/auth/login", roleAdmin, roleAdmin)
	handleMe(r, pool, "/admin/auth/me", roleAdmin, roleAdmin)

	// Legacy aliases (treated as student portal)
	handleRegister(r, pool, "/auth/register", roleStudent, roleStudent)
	handleLogin(r, pool, "/auth/login", roleStudent, roleStudent)
	handleMe(r, pool, "/auth/me", roleStudent, roleStudent)
}
