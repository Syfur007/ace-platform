package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
)

func main() {
	_ = context.Background()
	_ = jwt.RegisteredClaims{}
	_ = pgx.ConnConfig{}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"ts":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
