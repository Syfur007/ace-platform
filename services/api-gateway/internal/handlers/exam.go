package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
)

type ExamSessionStatus string

const (
	ExamSessionActive   ExamSessionStatus = "active"
	ExamSessionFinished ExamSessionStatus = "finished"
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

type ExamSessionResponse struct {
	SessionID        string          `json:"sessionId"`
	Status           ExamSessionStatus `json:"status"`
	CreatedAt        string          `json:"createdAt"`
	UpdatedAt        string          `json:"updatedAt"`
	LastHeartbeatAt  string          `json:"lastHeartbeatAt"`
	Snapshot         json.RawMessage `json:"snapshot"`
}

func RegisterExamRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	// Server-backed exam session state (student portal).
	studentAuth := auth.RequirePortalAuth("student", "student")

	r.POST("/exam-sessions/:sessionId/heartbeat", studentAuth, func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		var req HeartbeatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}

		// Trust the path param as the canonical session id.
		if req.SessionID == "" {
			req.SessionID = sessionID
		}
		if req.SessionID != sessionID {
			c.JSON(http.StatusBadRequest, gin.H{"message": "sessionId mismatch"})
			return
		}

		snapshot := req.Snapshot
		if len(snapshot) == 0 {
			snapshot = []byte("{}")
		}

		now := time.Now().UTC()
		ctx := context.Background()
		_, err := pool.Exec(ctx, `insert into exam_sessions (user_id, id, status, snapshot, created_at, updated_at, last_heartbeat_at)
			values ($1,$2,$3,$4,now(),now(),now())
			on conflict (user_id, id) do update set snapshot=excluded.snapshot, updated_at=excluded.updated_at, last_heartbeat_at=excluded.last_heartbeat_at`,
			userID, sessionID, string(ExamSessionActive), snapshot)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to persist heartbeat"})
			return
		}

		c.JSON(http.StatusOK, HeartbeatResponse{Ok: true, ServerTS: now.Format(time.RFC3339)})
	})

	r.GET("/exam-sessions/:sessionId", studentAuth, func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		ctx := context.Background()

		var status string
		var snapshot []byte
		var createdAt time.Time
		var updatedAt time.Time
		var lastHeartbeatAt time.Time

		err := pool.QueryRow(ctx, `select status, snapshot, created_at, updated_at, last_heartbeat_at
			from exam_sessions where user_id=$1 and id=$2`, userID, sessionID).
			Scan(&status, &snapshot, &createdAt, &updatedAt, &lastHeartbeatAt)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		if len(snapshot) == 0 {
			snapshot = []byte("{}")
		}

		c.JSON(http.StatusOK, ExamSessionResponse{
			SessionID:       sessionID,
			Status:          ExamSessionStatus(status),
			CreatedAt:       createdAt.UTC().Format(time.RFC3339),
			UpdatedAt:       updatedAt.UTC().Format(time.RFC3339),
			LastHeartbeatAt: lastHeartbeatAt.UTC().Format(time.RFC3339),
			Snapshot:        json.RawMessage(snapshot),
		})
	})
}
