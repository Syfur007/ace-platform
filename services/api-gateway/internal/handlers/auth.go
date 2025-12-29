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
	CreatedAt string `json:"createdAt"`
}

type AuthResponse struct {
	AccessToken string       `json:"accessToken"`
	User        UserResponse `json:"user"`
}

func RegisterAuthRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	r.POST("/auth/register", func(c *gin.Context) {
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
		_, err = pool.Exec(ctx, `insert into users (id, email, password_hash) values ($1, $2, $3)`, userID, email, hash)
		if err != nil {
			// cheap conflict detection
			c.JSON(http.StatusBadRequest, gin.H{"message": "user already exists or invalid"})
			return
		}

		var createdAt time.Time
		_ = pool.QueryRow(ctx, `select created_at from users where id=$1`, userID).Scan(&createdAt)

		token, err := auth.IssueAccessToken(userID, 24*time.Hour)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue token"})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{
			AccessToken: token,
			User: UserResponse{ID: userID, Email: email, CreatedAt: createdAt.UTC().Format(time.RFC3339)},
		})
	})

	r.POST("/auth/login", func(c *gin.Context) {
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
		err := pool.QueryRow(ctx, `select id, password_hash, created_at from users where email=$1`, email).Scan(&userID, &passwordHash, &createdAt)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid credentials"})
			return
		}

		if !auth.VerifyPassword(passwordHash, req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid credentials"})
			return
		}

		token, err := auth.IssueAccessToken(userID, 24*time.Hour)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue token"})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{
			AccessToken: token,
			User: UserResponse{ID: userID, Email: email, CreatedAt: createdAt.UTC().Format(time.RFC3339)},
		})
	})

	r.GET("/auth/me", auth.RequireAuth(), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		ctx := context.Background()
		var email string
		var createdAt time.Time
		err := pool.QueryRow(ctx, `select email, created_at from users where id=$1`, userID).Scan(&email, &createdAt)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		c.JSON(http.StatusOK, UserResponse{ID: userID, Email: email, CreatedAt: createdAt.UTC().Format(time.RFC3339)})
	})
}
