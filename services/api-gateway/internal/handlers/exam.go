package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
)

type ExamSessionStatus string

const (
	ExamSessionActive   ExamSessionStatus = "active"
	ExamSessionFinished ExamSessionStatus = "finished"
	ExamSessionTerminated ExamSessionStatus = "terminated"
	ExamSessionInvalid  ExamSessionStatus = "invalid"
)

type ExamEventRequest struct {
	EventType string          `json:"eventType"`
	Payload   json.RawMessage `json:"payload"`
	TS        string          `json:"ts"`
}

type OkResponse struct {
	Ok bool `json:"ok"`
}

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
	SubmittedAt      *string         `json:"submittedAt,omitempty"`
	Snapshot         json.RawMessage `json:"snapshot"`
}

type ExamSessionListItem struct {
	SessionID       string          `json:"sessionId"`
	Status          ExamSessionStatus `json:"status"`
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt"`
	LastHeartbeatAt string          `json:"lastHeartbeatAt"`
	SubmittedAt     *string         `json:"submittedAt,omitempty"`
}

type ListExamSessionsResponse struct {
	Items   []ExamSessionListItem `json:"items"`
	Limit   int                  `json:"limit"`
	Offset  int                  `json:"offset"`
	HasMore bool                 `json:"hasMore"`
}

func RegisterExamRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	// Server-backed exam session state (student portal).
	studentAuth := auth.RequirePortalAuth(pool, "student", "student")

	r.GET("/exam-sessions", studentAuth, func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		limit, offset := parseListParams(c)
			status := c.Query("status")
			if status != "" && status != string(ExamSessionActive) && status != string(ExamSessionFinished) && status != string(ExamSessionTerminated) && status != string(ExamSessionInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid status"})
			return
		}

		ctx := context.Background()

		args := []any{userID}
		query := `select id, status, created_at, updated_at, last_heartbeat_at, submitted_at
			from exam_sessions where user_id=$1`
		if status != "" {
			query += " and status=$2"
			args = append(args, status)
			query += " order by last_heartbeat_at desc limit $3 offset $4"
			args = append(args, limit+1, offset)
		} else {
			query += " order by last_heartbeat_at desc limit $2 offset $3"
			args = append(args, limit+1, offset)
		}

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list sessions"})
			return
		}
		defer rows.Close()

		items := make([]ExamSessionListItem, 0, limit)
		for rows.Next() {
			var id string
			var st string
			var createdAt time.Time
			var updatedAt time.Time
			var lastHeartbeatAt time.Time
			var submittedAt *time.Time
			if err := rows.Scan(&id, &st, &createdAt, &updatedAt, &lastHeartbeatAt, &submittedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list sessions"})
				return
			}

			var submittedAtStr *string
			if submittedAt != nil {
				v := submittedAt.UTC().Format(time.RFC3339)
				submittedAtStr = &v
			}

			items = append(items, ExamSessionListItem{
				SessionID:       id,
				Status:          ExamSessionStatus(st),
				CreatedAt:       createdAt.UTC().Format(time.RFC3339),
				UpdatedAt:       updatedAt.UTC().Format(time.RFC3339),
				LastHeartbeatAt: lastHeartbeatAt.UTC().Format(time.RFC3339),
				SubmittedAt:     submittedAtStr,
			})
			if len(items) == limit+1 {
				break
			}
		}

		hasMore := false
		if len(items) > limit {
			hasMore = true
			items = items[:limit]
		}

		c.JSON(http.StatusOK, ListExamSessionsResponse{Items: items, Limit: limit, Offset: offset, HasMore: hasMore})
	})

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

			var existingStatus string
			err := pool.QueryRow(ctx, `select status from exam_sessions where user_id=$1 and id=$2`, userID, sessionID).Scan(&existingStatus)
			if err == nil {
				if existingStatus != string(ExamSessionActive) {
					c.JSON(http.StatusConflict, gin.H{"message": "session is not active"})
					return
				}
			}

			_, err = pool.Exec(ctx, `insert into exam_sessions (user_id, id, status, snapshot, created_at, updated_at, last_heartbeat_at)
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
		var submittedAt *time.Time

		err := pool.QueryRow(ctx, `select status, snapshot, created_at, updated_at, last_heartbeat_at, submitted_at
			from exam_sessions where user_id=$1 and id=$2`, userID, sessionID).
			Scan(&status, &snapshot, &createdAt, &updatedAt, &lastHeartbeatAt, &submittedAt)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		if len(snapshot) == 0 {
			snapshot = []byte("{}")
		}

		var submittedAtStr *string
		if submittedAt != nil {
			v := submittedAt.UTC().Format(time.RFC3339)
			submittedAtStr = &v
		}

		c.JSON(http.StatusOK, ExamSessionResponse{
			SessionID:       sessionID,
			Status:          ExamSessionStatus(status),
			CreatedAt:       createdAt.UTC().Format(time.RFC3339),
			UpdatedAt:       updatedAt.UTC().Format(time.RFC3339),
			LastHeartbeatAt: lastHeartbeatAt.UTC().Format(time.RFC3339),
			SubmittedAt:     submittedAtStr,
			Snapshot:        json.RawMessage(snapshot),
		})
	})

	r.POST("/exam-sessions/:sessionId/submit", studentAuth, func(c *gin.Context) {
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
		var submittedAt *time.Time

		err := pool.QueryRow(ctx, `update exam_sessions
			set status=$1, updated_at=now(), submitted_at=coalesce(submitted_at, now())
			where user_id=$2 and id=$3 and status in ('active','finished')
			returning status, snapshot, created_at, updated_at, last_heartbeat_at, submitted_at`,
			string(ExamSessionFinished), userID, sessionID).
			Scan(&status, &snapshot, &createdAt, &updatedAt, &lastHeartbeatAt, &submittedAt)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		if len(snapshot) == 0 {
			snapshot = []byte("{}")
		}

		var submittedAtStr *string
		if submittedAt != nil {
			v := submittedAt.UTC().Format(time.RFC3339)
			submittedAtStr = &v
		}

		c.JSON(http.StatusOK, ExamSessionResponse{
			SessionID:       sessionID,
			Status:          ExamSessionStatus(status),
			CreatedAt:       createdAt.UTC().Format(time.RFC3339),
			UpdatedAt:       updatedAt.UTC().Format(time.RFC3339),
			LastHeartbeatAt: lastHeartbeatAt.UTC().Format(time.RFC3339),
			SubmittedAt:     submittedAtStr,
			Snapshot:        json.RawMessage(snapshot),
		})
	})

	r.POST("/exam-sessions/:sessionId/events", studentAuth, func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		sessionID := c.Param("sessionId")
		var req ExamEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}
		eventType := strings.TrimSpace(req.EventType)
		if eventType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "eventType is required"})
			return
		}
		payload := req.Payload
		if len(payload) == 0 {
			payload = []byte("{}")
		}

		ctx := context.Background()
		var exists bool
		if err := pool.QueryRow(ctx, `select exists(select 1 from exam_sessions where user_id=$1 and id=$2)`, userID, sessionID).Scan(&exists); err != nil || !exists {
			c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
			return
		}

		_, err := pool.Exec(ctx, `insert into exam_session_events (user_id, session_id, event_type, payload) values ($1,$2,$3,$4)`, userID, sessionID, eventType, payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to record event"})
			return
		}

		c.JSON(http.StatusOK, OkResponse{Ok: true})
	})
}
