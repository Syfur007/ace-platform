package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ace-platform/api-gateway/internal/db"
	"github.com/ace-platform/api-gateway/internal/handlers"
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

	if err := db.Migrate(context.Background(), pool); err != nil {
		log.Fatal(err)
	}

	r := gin.New()
	r.Use(gin.Recovery())

	// Minimal CORS for local dev: web runs on localhost:5173 and API on localhost:8080.
	// This keeps the gateway usable from the browser without requiring extra deps.
	r.Use(func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", "*")
		h.Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type,Accept,Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
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
	handlers.RegisterPracticeRoutes(r, pool)
	handlers.RegisterExamRoutes(r, pool)
	handlers.RegisterQuestionRoutes(r, pool)
	handlers.RegisterAdminRoutes(r, pool)

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
