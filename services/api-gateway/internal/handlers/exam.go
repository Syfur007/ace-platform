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
	ExamPackageID *string         `json:"examPackageId"`
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
	ExamPackageID    *string         `json:"examPackageId,omitempty"`
	Status           ExamSessionStatus `json:"status"`
	CreatedAt        string          `json:"createdAt"`
	UpdatedAt        string          `json:"updatedAt"`
	LastHeartbeatAt  string          `json:"lastHeartbeatAt"`
	SubmittedAt      *string         `json:"submittedAt,omitempty"`
	Snapshot         json.RawMessage `json:"snapshot"`
}

type ExamSessionListItem struct {
	SessionID       string          `json:"sessionId"`
	ExamPackageID   *string         `json:"examPackageId,omitempty"`
	Status          ExamSessionStatus `json:"status"`
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt"`
	LastHeartbeatAt string          `json:"lastHeartbeatAt"`
	SubmittedAt     *string         `json:"submittedAt,omitempty"`
}

func resolveEnrolledExamPackageID(ctx context.Context, pool *pgxpool.Pool, userID string, requested *string) (string, int, string) {
	// Return (packageId, httpStatus, message). httpStatus==0 means ok.
	if requested != nil {
		pkg := strings.TrimSpace(*requested)
		if pkg != "" {
			var enrolled bool
			if err := pool.QueryRow(ctx, `select exists(select 1 from user_exam_package_enrollments where user_id=$1 and exam_package_id=$2)`, userID, pkg).Scan(&enrolled); err != nil || !enrolled {
				return "", http.StatusForbidden, "not enrolled"
			}
			return pkg, 0, ""
		}
	}

	rows, err := pool.Query(ctx, `select exam_package_id from user_exam_package_enrollments where user_id=$1 order by created_at asc`, userID)
	if err != nil {
		return "", http.StatusInternalServerError, "failed to resolve enrollment"
	}
	defer rows.Close()

	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return "", http.StatusForbidden, "not enrolled"
	}
	if len(ids) > 1 {
		return "", http.StatusBadRequest, "examPackageId is required when enrolled in multiple packages"
	}
	return ids[0], 0, ""
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
			query := `select id, exam_package_id, status, created_at, updated_at, last_heartbeat_at, submitted_at
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
			var examPackageID *string
			var submittedAt *time.Time
			if err := rows.Scan(&id, &examPackageID, &st, &createdAt, &updatedAt, &lastHeartbeatAt, &submittedAt); err != nil {
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
				ExamPackageID:   examPackageID,
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

			resolvedPkg, statusCode, msg := resolveEnrolledExamPackageID(ctx, pool, userID, req.ExamPackageID)
			if statusCode != 0 {
				c.JSON(statusCode, gin.H{"message": msg})
				return
			}

			var existingStatus string
			var existingPkg *string
			err := pool.QueryRow(ctx, `select status, exam_package_id from exam_sessions where user_id=$1 and id=$2`, userID, sessionID).Scan(&existingStatus, &existingPkg)
			if err == nil {
				if existingStatus != string(ExamSessionActive) {
					c.JSON(http.StatusConflict, gin.H{"message": "session is not active"})
					return
				}
				if existingPkg != nil && *existingPkg != "" && *existingPkg != resolvedPkg {
					c.JSON(http.StatusConflict, gin.H{"message": "examPackageId mismatch"})
					return
				}
			}

			_, err = pool.Exec(ctx, `insert into exam_sessions (user_id, id, status, exam_package_id, snapshot, created_at, updated_at, last_heartbeat_at)
				values ($1,$2,$3,$4,$5,now(),now(),now())
				on conflict (user_id, id) do update set
					exam_package_id = coalesce(exam_sessions.exam_package_id, excluded.exam_package_id),
					snapshot=excluded.snapshot,
					updated_at=excluded.updated_at,
					last_heartbeat_at=excluded.last_heartbeat_at`,
				userID, sessionID, string(ExamSessionActive), resolvedPkg, snapshot)
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
		var examPackageID *string
		var snapshot []byte
		var createdAt time.Time
		var updatedAt time.Time
		var lastHeartbeatAt time.Time
		var submittedAt *time.Time

		err := pool.QueryRow(ctx, `select status, exam_package_id, snapshot, created_at, updated_at, last_heartbeat_at, submitted_at
			from exam_sessions where user_id=$1 and id=$2`, userID, sessionID).
			Scan(&status, &examPackageID, &snapshot, &createdAt, &updatedAt, &lastHeartbeatAt, &submittedAt)
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
			ExamPackageID:   examPackageID,
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
		var examPackageID *string
		var snapshot []byte
		var createdAt time.Time
		var updatedAt time.Time
		var lastHeartbeatAt time.Time
		var submittedAt *time.Time

		err := pool.QueryRow(ctx, `update exam_sessions
			set status=$1, updated_at=now(), submitted_at=coalesce(submitted_at, now())
			where user_id=$2 and id=$3 and status in ('active','finished')
			returning status, exam_package_id, snapshot, created_at, updated_at, last_heartbeat_at, submitted_at`,
			string(ExamSessionFinished), userID, sessionID).
			Scan(&status, &examPackageID, &snapshot, &createdAt, &updatedAt, &lastHeartbeatAt, &submittedAt)
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
			ExamPackageID:   examPackageID,
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
