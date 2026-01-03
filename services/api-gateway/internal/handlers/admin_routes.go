package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
	"github.com/ace-platform/api-gateway/internal/util"
)

type AdminUserListItem struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	Role      string  `json:"role"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
	DeletedAt *string `json:"deletedAt,omitempty"`
}

type ListAdminUsersResponse struct {
	Items   []AdminUserListItem `json:"items"`
	Limit   int                 `json:"limit"`
	Offset  int                 `json:"offset"`
	HasMore bool                `json:"hasMore"`
}

type CreateAdminUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type UpdateAdminUserRequest struct {
	Email    *string `json:"email"`
	Password *string `json:"password"`
	Role     *string `json:"role"`
}

type AdminExamSessionListItem struct {
	UserID          string  `json:"userId"`
	UserEmail       string  `json:"userEmail"`
	SessionID       string  `json:"sessionId"`
	Status          string  `json:"status"`
	CreatedAt       string  `json:"createdAt"`
	UpdatedAt       string  `json:"updatedAt"`
	LastHeartbeatAt string  `json:"lastHeartbeatAt"`
	SubmittedAt     *string `json:"submittedAt,omitempty"`
	TerminatedAt    *string `json:"terminatedAt,omitempty"`
	InvalidatedAt   *string `json:"invalidatedAt,omitempty"`
}

type ListAdminExamSessionsResponse struct {
	Items   []AdminExamSessionListItem `json:"items"`
	Limit   int                        `json:"limit"`
	Offset  int                        `json:"offset"`
	HasMore bool                       `json:"hasMore"`
}

type AdminExamSessionResponse struct {
	UserID          string          `json:"userId"`
	UserEmail       string          `json:"userEmail"`
	SessionID       string          `json:"sessionId"`
	Status          string          `json:"status"`
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt"`
	LastHeartbeatAt string          `json:"lastHeartbeatAt"`
	SubmittedAt     *string         `json:"submittedAt,omitempty"`
	TerminatedAt    *string         `json:"terminatedAt,omitempty"`
	TerminatedBy    *string         `json:"terminatedByUserId,omitempty"`
	TerminationReason string        `json:"terminationReason"`
	InvalidatedAt   *string         `json:"invalidatedAt,omitempty"`
	InvalidatedBy   *string         `json:"invalidatedByUserId,omitempty"`
	InvalidationReason string       `json:"invalidationReason"`
	Snapshot        json.RawMessage `json:"snapshot"`
}

type AdminExamActionRequest struct {
	Reason string `json:"reason"`
}

type AdminFlagRequest struct {
	FlagType string `json:"flagType"`
	Note     string `json:"note"`
}

type AdminExamEventListItem struct {
	ID        int64           `json:"id"`
	EventType string          `json:"eventType"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt string          `json:"createdAt"`
}

type ListAdminExamEventsResponse struct {
	Items   []AdminExamEventListItem `json:"items"`
	Limit   int                      `json:"limit"`
	Offset  int                      `json:"offset"`
	HasMore bool                     `json:"hasMore"`
}

type AdminDashboardUsersStats struct {
	Total   int64            `json:"total"`
	Active  int64            `json:"active"`
	Deleted int64            `json:"deleted"`
	ByRole  map[string]int64 `json:"byRole"`
}

type AdminDashboardQuestionBankStats struct {
	Packages  int64            `json:"packages"`
	Topics    int64            `json:"topics"`
	Questions int64            `json:"questions"`
	ByStatus  map[string]int64 `json:"byStatus"`
}

type AdminDashboardExamStats struct {
	Sessions  int64            `json:"sessions"`
	Submitted int64            `json:"submitted"`
	ByStatus  map[string]int64 `json:"byStatus"`
	Events    int64            `json:"events"`
	Flags     int64            `json:"flags"`
}

type AdminDashboardStatsResponse struct {
	Ts           string                         `json:"ts"`
	Users        AdminDashboardUsersStats       `json:"users"`
	QuestionBank AdminDashboardQuestionBankStats `json:"questionBank"`
	Exams        AdminDashboardExamStats        `json:"exams"`
}

func isValidRole(role string) bool {
	return role == "student" || role == "instructor" || role == "admin"
}

func parseBoolQuery(c *gin.Context, key string) bool {
	raw := strings.TrimSpace(strings.ToLower(c.Query(key)))
	return raw == "1" || raw == "true" || raw == "yes" || raw == "y"
}

func audit(ctx context.Context, pool *pgxpool.Pool, actorUserID string, actorRole string, action string, targetType string, targetID string, metadata any) {
	payload := []byte("{}")
	if metadata != nil {
		if b, err := json.Marshal(metadata); err == nil {
			payload = b
		}
	}
	_, _ = pool.Exec(ctx, `insert into audit_log (actor_user_id, actor_role, action, target_type, target_id, metadata) values ($1,$2,$3,$4,$5,$6)`, actorUserID, actorRole, action, targetType, targetID, payload)
}

func RegisterAdminRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	adminAuth := auth.RequirePortalAuth("admin", "admin")

	// Dashboard (lifetime totals)
	r.GET("/admin/dashboard", adminAuth, func(c *gin.Context) {
		ctx := context.Background()

		var usersTotal, usersActive, usersDeleted int64
		var usersStudent, usersInstructor, usersAdmin int64
		var qbPackages, qbTopics, qbQuestions int64
		var examSessions, examSubmitted int64
		var examEvents, examFlags int64

		err := pool.QueryRow(ctx, `
			select
				(select count(*) from users) as users_total,
				(select count(*) from users where deleted_at is null) as users_active,
				(select count(*) from users where deleted_at is not null) as users_deleted,
				(select count(*) from users where deleted_at is null and role='student') as users_student,
				(select count(*) from users where deleted_at is null and role='instructor') as users_instructor,
				(select count(*) from users where deleted_at is null and role='admin') as users_admin,
				(select count(*) from question_bank_packages) as qb_packages,
				(select count(*) from question_bank_topics) as qb_topics,
				(select count(*) from question_bank_questions) as qb_questions,
				(select count(*) from exam_sessions) as exam_sessions,
				(select count(*) from exam_sessions where submitted_at is not null) as exam_submitted,
				(select count(*) from exam_session_events) as exam_events,
				(select count(*) from exam_session_flags) as exam_flags
		`).Scan(
			&usersTotal,
			&usersActive,
			&usersDeleted,
			&usersStudent,
			&usersInstructor,
			&usersAdmin,
			&qbPackages,
			&qbTopics,
			&qbQuestions,
			&examSessions,
			&examSubmitted,
			&examEvents,
			&examFlags,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to compute dashboard stats"})
			return
		}

		questionByStatus := map[string]int64{}
		rows, err := pool.Query(ctx, `select status, count(*) from question_bank_questions group by status`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to compute question stats"})
			return
		}
		for rows.Next() {
			var status string
			var count int64
			if err := rows.Scan(&status, &count); err != nil {
				rows.Close()
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to compute question stats"})
				return
			}
			questionByStatus[status] = count
		}
		rows.Close()

		examByStatus := map[string]int64{}
		rows2, err := pool.Query(ctx, `select status, count(*) from exam_sessions group by status`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to compute exam stats"})
			return
		}
		for rows2.Next() {
			var status string
			var count int64
			if err := rows2.Scan(&status, &count); err != nil {
				rows2.Close()
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to compute exam stats"})
				return
			}
			examByStatus[status] = count
		}
		rows2.Close()

		c.JSON(http.StatusOK, AdminDashboardStatsResponse{
			Ts: time.Now().UTC().Format(time.RFC3339),
			Users: AdminDashboardUsersStats{
				Total:   usersTotal,
				Active:  usersActive,
				Deleted: usersDeleted,
				ByRole: map[string]int64{
					"student":    usersStudent,
					"instructor": usersInstructor,
					"admin":      usersAdmin,
				},
			},
			QuestionBank: AdminDashboardQuestionBankStats{
				Packages:  qbPackages,
				Topics:    qbTopics,
				Questions: qbQuestions,
				ByStatus:  questionByStatus,
			},
			Exams: AdminDashboardExamStats{
				Sessions:  examSessions,
				Submitted: examSubmitted,
				ByStatus:  examByStatus,
				Events:    examEvents,
				Flags:     examFlags,
			},
		})
	})

	// IAM
	{
		r.GET("/admin/users", adminAuth, func(c *gin.Context) {
			limit, offset := parseListParams(c)
			role := strings.TrimSpace(strings.ToLower(c.Query("role")))
			includeDeleted := parseBoolQuery(c, "includeDeleted")
			if role != "" && !isValidRole(role) {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid role"})
				return
			}

			where := []string{"1=1"}
			args := []any{}
			if !includeDeleted {
				where = append(where, "deleted_at is null")
			}
			if role != "" {
				where = append(where, "role="+sqlParam(len(args)+1))
				args = append(args, role)
			}

			query := `select id, email, role, created_at, updated_at, deleted_at from users where ` + strings.Join(where, " and ") +
				` order by created_at desc limit ` + sqlParam(len(args)+1) + ` offset ` + sqlParam(len(args)+2)
			args = append(args, limit+1, offset)

			rows, err := pool.Query(context.Background(), query, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list users"})
				return
			}
			defer rows.Close()

			items := make([]AdminUserListItem, 0, limit)
			for rows.Next() {
				var id, email, rrole string
				var createdAt, updatedAt time.Time
				var deletedAt *time.Time
				if err := rows.Scan(&id, &email, &rrole, &createdAt, &updatedAt, &deletedAt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list users"})
					return
				}
				var deletedAtStr *string
				if deletedAt != nil {
					v := deletedAt.UTC().Format(time.RFC3339)
					deletedAtStr = &v
				}
				items = append(items, AdminUserListItem{
					ID:        id,
					Email:     email,
					Role:      rrole,
					CreatedAt: createdAt.UTC().Format(time.RFC3339),
					UpdatedAt: updatedAt.UTC().Format(time.RFC3339),
					DeletedAt: deletedAtStr,
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
			c.JSON(http.StatusOK, ListAdminUsersResponse{Items: items, Limit: limit, Offset: offset, HasMore: hasMore})
		})

		r.GET("/admin/users/:userId", adminAuth, func(c *gin.Context) {
			userID := c.Param("userId")
			ctx := context.Background()
			var id, email, role string
			var createdAt, updatedAt time.Time
			var deletedAt *time.Time
			err := pool.QueryRow(ctx, `select id, email, role, created_at, updated_at, deleted_at from users where id=$1`, userID).
				Scan(&id, &email, &role, &createdAt, &updatedAt, &deletedAt)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "user not found"})
				return
			}

			var deletedAtStr *string
			if deletedAt != nil {
				v := deletedAt.UTC().Format(time.RFC3339)
				deletedAtStr = &v
			}
			c.JSON(http.StatusOK, AdminUserListItem{
				ID:        id,
				Email:     email,
				Role:      role,
				CreatedAt: createdAt.UTC().Format(time.RFC3339),
				UpdatedAt: updatedAt.UTC().Format(time.RFC3339),
				DeletedAt: deletedAtStr,
			})
		})

		r.POST("/admin/users", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			var req CreateAdminUserRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			email := strings.TrimSpace(strings.ToLower(req.Email))
			if email == "" || req.Password == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "email and password are required"})
				return
			}
			role := strings.TrimSpace(strings.ToLower(req.Role))
			if !isValidRole(role) {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid role"})
				return
			}

			hash, err := auth.HashPassword(req.Password)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to hash password"})
				return
			}

			id := util.NewID("usr")
			ctx := context.Background()
			_, err = pool.Exec(ctx, `insert into users (id, email, password_hash, role, created_at, updated_at) values ($1,$2,$3,$4,now(),now())`, id, email, hash, role)
			if err != nil {
				var pgerr *pgconn.PgError
				if errors.As(err, &pgerr) && pgerr.Code == "23505" {
					c.JSON(http.StatusConflict, gin.H{"message": "email already exists"})
					return
				}
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create user"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "user.create", "user", id, gin.H{"role": role, "email": email})
			c.JSON(http.StatusOK, gin.H{"id": id})
		})

		r.PATCH("/admin/users/:userId", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			userID := c.Param("userId")
			var req UpdateAdminUserRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			set := []string{"updated_at=now()"}
			args := []any{}

			if req.Email != nil {
				email := strings.TrimSpace(strings.ToLower(*req.Email))
				if email == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "email cannot be empty"})
					return
				}
				set = append(set, "email="+sqlParam(len(args)+1))
				args = append(args, email)
			}
			if req.Role != nil {
				role := strings.TrimSpace(strings.ToLower(*req.Role))
				if !isValidRole(role) {
					c.JSON(http.StatusBadRequest, gin.H{"message": "invalid role"})
					return
				}
				set = append(set, "role="+sqlParam(len(args)+1))
				args = append(args, role)
			}
			if req.Password != nil {
				if *req.Password == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "password cannot be empty"})
					return
				}
				hash, err := auth.HashPassword(*req.Password)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to hash password"})
					return
				}
				set = append(set, "password_hash="+sqlParam(len(args)+1))
				args = append(args, hash)
			}

			if len(set) == 1 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "no updates"})
				return
			}

			ctx := context.Background()
			args = append(args, userID)
			query := `update users set ` + strings.Join(set, ", ") + ` where id=` + sqlParam(len(args))
			cmd, err := pool.Exec(ctx, query, args...)
			if err != nil {
				var pgerr *pgconn.PgError
				if errors.As(err, &pgerr) && pgerr.Code == "23505" {
					c.JSON(http.StatusConflict, gin.H{"message": "email already exists"})
					return
				}
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update user"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "user not found"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "user.update", "user", userID, gin.H{"updated": true})
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.DELETE("/admin/users/:userId", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			userID := c.Param("userId")
			ctx := context.Background()
			cmd, err := pool.Exec(ctx, `update users set deleted_at=coalesce(deleted_at, now()), updated_at=now() where id=$1`, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to delete user"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "user not found"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "user.delete", "user", userID, nil)
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.POST("/admin/users/:userId/restore", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			userID := c.Param("userId")
			ctx := context.Background()
			cmd, err := pool.Exec(ctx, `update users set deleted_at=null, updated_at=now() where id=$1`, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to restore user"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "user not found"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "user.restore", "user", userID, nil)
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})
	}

	// Exam integrity suite (admin oversight)
	{
		r.GET("/admin/exam-sessions", adminAuth, func(c *gin.Context) {
			limit, offset := parseListParams(c)
			status := strings.TrimSpace(strings.ToLower(c.Query("status")))
			if status != "" && status != "active" && status != "finished" && status != "terminated" && status != "invalid" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid status"})
				return
			}

			args := []any{}
			where := []string{"1=1"}
			if status != "" {
				where = append(where, "s.status="+sqlParam(len(args)+1))
				args = append(args, status)
			}

			query := `select s.user_id, u.email, s.id, s.status, s.created_at, s.updated_at, s.last_heartbeat_at, s.submitted_at, s.terminated_at, s.invalidated_at
				from exam_sessions s join users u on u.id=s.user_id where ` + strings.Join(where, " and ") +
				` order by s.last_heartbeat_at desc limit ` + sqlParam(len(args)+1) + ` offset ` + sqlParam(len(args)+2)
			args = append(args, limit+1, offset)

			rows, err := pool.Query(context.Background(), query, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list sessions"})
				return
			}
			defer rows.Close()

			items := make([]AdminExamSessionListItem, 0, limit)
			for rows.Next() {
				var userID, userEmail, sessionID, st string
				var createdAt, updatedAt, lastHb time.Time
				var submittedAt, terminatedAt, invalidatedAt *time.Time
				if err := rows.Scan(&userID, &userEmail, &sessionID, &st, &createdAt, &updatedAt, &lastHb, &submittedAt, &terminatedAt, &invalidatedAt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list sessions"})
					return
				}

				toStr := func(t *time.Time) *string {
					if t == nil {
						return nil
					}
					v := t.UTC().Format(time.RFC3339)
					return &v
				}

				items = append(items, AdminExamSessionListItem{
					UserID:          userID,
					UserEmail:       userEmail,
					SessionID:       sessionID,
					Status:          st,
					CreatedAt:       createdAt.UTC().Format(time.RFC3339),
					UpdatedAt:       updatedAt.UTC().Format(time.RFC3339),
					LastHeartbeatAt: lastHb.UTC().Format(time.RFC3339),
					SubmittedAt:     toStr(submittedAt),
					TerminatedAt:    toStr(terminatedAt),
					InvalidatedAt:   toStr(invalidatedAt),
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

			c.JSON(http.StatusOK, ListAdminExamSessionsResponse{Items: items, Limit: limit, Offset: offset, HasMore: hasMore})
		})

		r.GET("/admin/exam-sessions/:userId/:sessionId", adminAuth, func(c *gin.Context) {
			userID := c.Param("userId")
			sessionID := c.Param("sessionId")
			ctx := context.Background()

			var email string
			var status string
			var snapshot []byte
			var createdAt, updatedAt, lastHb time.Time
			var submittedAt, terminatedAt, invalidatedAt *time.Time
			var terminatedBy, invalidatedBy *string
			var terminationReason, invalidationReason string

			err := pool.QueryRow(ctx, `select u.email, s.status, s.snapshot, s.created_at, s.updated_at, s.last_heartbeat_at, s.submitted_at,
				s.terminated_at, s.terminated_by_user_id, s.termination_reason,
				s.invalidated_at, s.invalidated_by_user_id, s.invalidation_reason
				from exam_sessions s join users u on u.id=s.user_id where s.user_id=$1 and s.id=$2`, userID, sessionID).
				Scan(&email, &status, &snapshot, &createdAt, &updatedAt, &lastHb, &submittedAt, &terminatedAt, &terminatedBy, &terminationReason, &invalidatedAt, &invalidatedBy, &invalidationReason)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
				return
			}

			if len(snapshot) == 0 {
				snapshot = []byte("{}")
			}

			toStr := func(t *time.Time) *string {
				if t == nil {
					return nil
				}
				v := t.UTC().Format(time.RFC3339)
				return &v
			}

			c.JSON(http.StatusOK, AdminExamSessionResponse{
				UserID:            userID,
				UserEmail:         email,
				SessionID:         sessionID,
				Status:            status,
				CreatedAt:         createdAt.UTC().Format(time.RFC3339),
				UpdatedAt:         updatedAt.UTC().Format(time.RFC3339),
				LastHeartbeatAt:   lastHb.UTC().Format(time.RFC3339),
				SubmittedAt:       toStr(submittedAt),
				TerminatedAt:      toStr(terminatedAt),
				TerminatedBy:      terminatedBy,
				TerminationReason: terminationReason,
				InvalidatedAt:     toStr(invalidatedAt),
				InvalidatedBy:     invalidatedBy,
				InvalidationReason: invalidationReason,
				Snapshot:          json.RawMessage(snapshot),
			})
		})

		r.POST("/admin/exam-sessions/:userId/:sessionId/force-submit", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			userID := c.Param("userId")
			sessionID := c.Param("sessionId")
			ctx := context.Background()

			cmd, err := pool.Exec(ctx, `update exam_sessions set status='finished', updated_at=now(), submitted_at=coalesce(submitted_at, now())
				where user_id=$1 and id=$2 and status in ('active','finished')`, userID, sessionID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to force submit"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "exam.force_submit", "exam_session", userID+":"+sessionID, nil)
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.POST("/admin/exam-sessions/:userId/:sessionId/terminate", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			userID := c.Param("userId")
			sessionID := c.Param("sessionId")
			var req AdminExamActionRequest
			_ = c.ShouldBindJSON(&req)
			reason := strings.TrimSpace(req.Reason)

			ctx := context.Background()
			cmd, err := pool.Exec(ctx, `update exam_sessions set status='terminated', updated_at=now(), terminated_at=coalesce(terminated_at, now()),
				terminated_by_user_id=$3, termination_reason=$4
				where user_id=$1 and id=$2 and status in ('active','finished')`, userID, sessionID, actorUserID, reason)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to terminate"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "exam.terminate", "exam_session", userID+":"+sessionID, gin.H{"reason": reason})
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.POST("/admin/exam-sessions/:userId/:sessionId/invalidate", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			userID := c.Param("userId")
			sessionID := c.Param("sessionId")
			var req AdminExamActionRequest
			_ = c.ShouldBindJSON(&req)
			reason := strings.TrimSpace(req.Reason)

			ctx := context.Background()
			cmd, err := pool.Exec(ctx, `update exam_sessions set status='invalid', updated_at=now(), invalidated_at=coalesce(invalidated_at, now()),
				invalidated_by_user_id=$3, invalidation_reason=$4
				where user_id=$1 and id=$2`, userID, sessionID, actorUserID, reason)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to invalidate"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "exam.invalidate", "exam_session", userID+":"+sessionID, gin.H{"reason": reason})
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.POST("/admin/exam-sessions/:userId/:sessionId/flags", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			userID := c.Param("userId")
			sessionID := c.Param("sessionId")
			var req AdminFlagRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			flagType := strings.TrimSpace(req.FlagType)
			note := strings.TrimSpace(req.Note)
			if flagType == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "flagType is required"})
				return
			}

			ctx := context.Background()
			_, err := pool.Exec(ctx, `insert into exam_session_flags (user_id, session_id, flag_type, note, created_by_user_id) values ($1,$2,$3,$4,$5)`, userID, sessionID, flagType, note, actorUserID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create flag"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "exam.flag", "exam_session", userID+":"+sessionID, gin.H{"flagType": flagType})
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.GET("/admin/exam-sessions/:userId/:sessionId/events", adminAuth, func(c *gin.Context) {
			userID := c.Param("userId")
			sessionID := c.Param("sessionId")
			limit, offset := parseListParams(c)

			ctx := context.Background()
			rows, err := pool.Query(ctx, `select id, event_type, payload, created_at from exam_session_events
				where user_id=$1 and session_id=$2 order by id desc limit $3 offset $4`, userID, sessionID, limit+1, offset)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list events"})
				return
			}
			defer rows.Close()

			items := make([]AdminExamEventListItem, 0, limit)
			for rows.Next() {
				var id int64
				var typ string
				var payload []byte
				var createdAt time.Time
				if err := rows.Scan(&id, &typ, &payload, &createdAt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list events"})
					return
				}
				if len(payload) == 0 {
					payload = []byte("{}")
				}
				items = append(items, AdminExamEventListItem{ID: id, EventType: typ, Payload: json.RawMessage(payload), CreatedAt: createdAt.UTC().Format(time.RFC3339)})
				if len(items) == limit+1 {
					break
				}
			}

			hasMore := false
			if len(items) > limit {
				hasMore = true
				items = items[:limit]
			}

			c.JSON(http.StatusOK, ListAdminExamEventsResponse{Items: items, Limit: limit, Offset: offset, HasMore: hasMore})
		})
	}
}

