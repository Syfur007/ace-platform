package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ace-platform/api-gateway/internal/db"
	"github.com/ace-platform/api-gateway/internal/handlers"
)

type HeartbeatRequest struct {
	SessionID string          `json:"sessionId"`
	TS        string          `json:"ts"`
	Snapshot  json.RawMessage `json:"snapshot"`
}

type HeartbeatResponse struct {
	Ok       bool   `json:"ok"`
	ServerTS string `json:"serverTs"`
}

type HeartbeatStore struct {
	mu   sync.Mutex
	data map[string]HeartbeatRequest
}

func NewHeartbeatStore() *HeartbeatStore {
	return &HeartbeatStore{data: make(map[string]HeartbeatRequest)}
}

func (s *HeartbeatStore) Put(sessionID string, hb HeartbeatRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[sessionID] = hb
}

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

	store := NewHeartbeatStore()

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"ts":     time.Now().UTC().Format(time.RFC3339),
		})
	})

	r.POST("/exam-sessions/:sessionId/heartbeat", func(c *gin.Context) {
		sessionID := c.Param("sessionId")
		var req HeartbeatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "invalid json body",
				"error":   err.Error(),
			})
			return
		}

		// Trust the path param as the canonical session id.
		if req.SessionID == "" {
			req.SessionID = sessionID
		}

		store.Put(sessionID, req)

		c.JSON(http.StatusOK, HeartbeatResponse{
			Ok:       true,
			ServerTS: time.Now().UTC().Format(time.RFC3339),
		})
	})

	handlers.RegisterAuthRoutes(r, pool)
	handlers.RegisterPracticeRoutes(r, pool)

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
