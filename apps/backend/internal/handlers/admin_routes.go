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

	"github.com/ace-platform/apps/backend/internal/auth"
	"github.com/ace-platform/apps/backend/internal/util"
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

type AdminAuthSessionListItem struct {
	ID           string  `json:"id"`
	Role         string  `json:"role"`
	Audience     string  `json:"audience"`
	IP           string  `json:"ip"`
	UserAgent    string  `json:"userAgent"`
	CreatedAt    string  `json:"createdAt"`
	LastSeenAt   string  `json:"lastSeenAt"`
	ExpiresAt    string  `json:"expiresAt"`
	RevokedAt    *string `json:"revokedAt,omitempty"`
	RevokedReason string `json:"revokedReason"`
}

type ListAdminAuthSessionsResponse struct {
	Items   []AdminAuthSessionListItem `json:"items"`
	Limit   int                        `json:"limit"`
	Offset  int                        `json:"offset"`
	HasMore bool                       `json:"hasMore"`
}

type AdminSetUserSessionLimitRequest struct {
	MaxActiveSessions *int `json:"maxActiveSessions"`
}

type AdminUserSessionLimitResponse struct {
	EffectiveMaxActiveSessions int  `json:"effectiveMaxActiveSessions"`
	UserMaxActiveSessions      *int `json:"userMaxActiveSessions,omitempty"`
	GroupMaxActiveSessions     *int `json:"groupMaxActiveSessions,omitempty"`
	RoleMaxActiveSessions      *int `json:"roleMaxActiveSessions,omitempty"`
}

type AdminSessionGroupListItem struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	MaxActiveSessions *int   `json:"maxActiveSessions,omitempty"`
}

type ListAdminSessionGroupsResponse struct {
	Items []AdminSessionGroupListItem `json:"items"`
}

type CreateAdminSessionGroupRequest struct {
	Name              string `json:"name"`
	MaxActiveSessions *int   `json:"maxActiveSessions"`
}

type UpdateAdminSessionGroupRequest struct {
	Name              *string `json:"name"`
	MaxActiveSessions *int    `json:"maxActiveSessions"`
}

type AddAdminSessionGroupMemberRequest struct {
	UserID string `json:"userId"`
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

type AdminExamPackageTier struct {
	ID            string          `json:"id"`
	ExamPackageID string          `json:"examPackageId"`
	Code          string          `json:"code"`
	Name          string          `json:"name"`
	SortOrder     int             `json:"sortOrder"`
	IsDefault     bool            `json:"isDefault"`
	IsActive      bool            `json:"isActive"`
	Policy        json.RawMessage `json:"policy"`
	CreatedAt     string          `json:"createdAt"`
	UpdatedAt     string          `json:"updatedAt"`
}

type ListAdminExamPackageTiersResponse struct {
	Items []AdminExamPackageTier `json:"items"`
}

type CreateAdminExamPackageTierRequest struct {
	Code      string           `json:"code"`
	Name      string           `json:"name"`
	SortOrder *int             `json:"sortOrder"`
	IsDefault *bool            `json:"isDefault"`
	IsActive  *bool            `json:"isActive"`
	Policy    *json.RawMessage `json:"policy"`
}

type CreateAdminExamPackageTierResponse struct {
	ID string `json:"id"`
}

type UpdateAdminExamPackageTierRequest struct {
	Code      *string          `json:"code"`
	Name      *string          `json:"name"`
	SortOrder *int             `json:"sortOrder"`
	IsDefault *bool            `json:"isDefault"`
	IsActive  *bool            `json:"isActive"`
	Policy    *json.RawMessage `json:"policy"`
}

type AdminDashboardStatsResponse struct {
	Ts           string                         `json:"ts"`
	Users        AdminDashboardUsersStats       `json:"users"`
	QuestionBank AdminDashboardQuestionBankStats `json:"questionBank"`
	Exams        AdminDashboardExamStats        `json:"exams"`
}

type AdminExamPackageListItem struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Subtitle  *string `json:"subtitle"`
	Overview  *string `json:"overview"`
	Modules   []string `json:"modules"`
	Highlights []string `json:"highlights"`
	ModuleSections []ExamPackageModuleSection `json:"moduleSections"`
	IsHidden  bool   `json:"isHidden"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type ListAdminExamPackagesResponse struct {
	Items []AdminExamPackageListItem `json:"items"`
}

type CreateAdminExamPackageRequest struct {
	Name           string                   `json:"name"`
	Subtitle       *string                  `json:"subtitle"`
	Overview       *string                  `json:"overview"`
	Modules        []string                 `json:"modules"`
	Highlights     []string                 `json:"highlights"`
	ModuleSections []ExamPackageModuleSection `json:"moduleSections"`
	IsHidden       *bool                    `json:"isHidden"`
}

type CreateAdminExamPackageResponse struct {
	ID string `json:"id"`
}

type UpdateAdminExamPackageRequest struct {
	Name           *string                    `json:"name"`
	Subtitle       *string                    `json:"subtitle"`
	Overview       *string                    `json:"overview"`
	Modules        *[]string                  `json:"modules"`
	Highlights     *[]string                  `json:"highlights"`
	ModuleSections *[]ExamPackageModuleSection `json:"moduleSections"`
	IsHidden       *bool                      `json:"isHidden"`
}

func isValidRole(role string) bool {
	return role == "student" || role == "instructor" || role == "admin"
}

func parseBoolQuery(c *gin.Context, key string) bool {
	raw := strings.TrimSpace(strings.ToLower(c.Query(key)))
	return raw == "1" || raw == "true" || raw == "yes" || raw == "y"
}

func clampMaxSessions(v int) int {
	if v < 1 {
		return 1
	}
	if v > 50 {
		return 50
	}
	return v
}

func revokeAuthSession(ctx context.Context, pool *pgxpool.Pool, sessionID string, reason string) {
	_, _ = pool.Exec(ctx, `update auth_sessions set revoked_at=now(), revoked_reason=$2 where id=$1 and revoked_at is null`, sessionID, reason)
	_, _ = pool.Exec(ctx, `update auth_refresh_tokens set revoked_at=now() where session_id=$1 and revoked_at is null`, sessionID)
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
	adminAuth := auth.RequirePortalAuth(pool, "admin", "admin")

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
				(select count(*) from question_banks) as qb_packages,
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

	// Exam packages (admin-only CRUD)
	{
		r.GET("/admin/exam-packages", adminAuth, func(c *gin.Context) {
			rows, err := pool.Query(context.Background(), `
				select
					id::text,
					code,
					name,
					subtitle,
					overview,
					modules,
					highlights,
					module_sections,
					is_hidden,
					created_at,
					updated_at
				from exam_packages
				order by name asc`)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list exam packages"})
				return
			}
			defer rows.Close()

			items := []AdminExamPackageListItem{}
			for rows.Next() {
				var id, code, name string
				var subtitle *string
				var overview *string
				var modulesRaw []byte
				var highlightsRaw []byte
				var moduleSectionsRaw []byte
				var hidden bool
				var createdAt time.Time
				var updatedAt time.Time
				if err := rows.Scan(
					&id,
					&code,
					&name,
					&subtitle,
					&overview,
					&modulesRaw,
					&highlightsRaw,
					&moduleSectionsRaw,
					&hidden,
					&createdAt,
					&updatedAt,
				); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list exam packages"})
					return
				}

				modules := []string{}
				if len(modulesRaw) > 0 {
					_ = json.Unmarshal(modulesRaw, &modules)
				}
				highlights := []string{}
				if len(highlightsRaw) > 0 {
					_ = json.Unmarshal(highlightsRaw, &highlights)
				}
				moduleSections := []ExamPackageModuleSection{}
				if len(moduleSectionsRaw) > 0 {
					_ = json.Unmarshal(moduleSectionsRaw, &moduleSections)
				}
				items = append(items, AdminExamPackageListItem{
					ID:        id,
					Code:      code,
					Name:      name,
					Subtitle:  subtitle,
					Overview:  overview,
					Modules:   modules,
					Highlights: highlights,
					ModuleSections: moduleSections,
					IsHidden:  hidden,
					CreatedAt: createdAt.UTC().Format(time.RFC3339),
					UpdatedAt: updatedAt.UTC().Format(time.RFC3339),
				})
			}
			c.JSON(http.StatusOK, ListAdminExamPackagesResponse{Items: items})
		})

		r.POST("/admin/exam-packages", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			var req CreateAdminExamPackageRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			name := strings.TrimSpace(req.Name)
			if name == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
				return
			}
			hidden := false
			if req.IsHidden != nil {
				hidden = *req.IsHidden
			}

			modules := req.Modules
			if modules == nil {
				modules = []string{}
			}
			modulesJSON, _ := json.Marshal(modules)
			highlights := req.Highlights
			if highlights == nil {
				highlights = []string{}
			}
			highlightsJSON, _ := json.Marshal(highlights)
			moduleSections := req.ModuleSections
			if moduleSections == nil {
				moduleSections = []ExamPackageModuleSection{}
			}
			moduleSectionsJSON, _ := json.Marshal(moduleSections)

			base := util.SlugifyLower(name)
			if base == "" {
				base = "package"
			}
			code := base

			ctx := context.Background()
			var id string
			for i := 0; i < 5; i++ {
				err := pool.QueryRow(ctx, `
					insert into exam_packages (code, name, subtitle, overview, modules, highlights, module_sections, is_hidden)
					values ($1,$2,$3,$4,$5,$6,$7,$8)
					returning id::text`,
					code,
					name,
					req.Subtitle,
					req.Overview,
					modulesJSON,
					highlightsJSON,
					moduleSectionsJSON,
					hidden,
				).Scan(&id)
				if err == nil {
					break
				}
				if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
					// code collision
					suffix := util.NewID("")
					if len(suffix) > 6 {
						suffix = suffix[:6]
					}
					code = base + "-" + suffix
					continue
				}
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create exam package"})
				return
			}
			if strings.TrimSpace(id) == "" {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create exam package"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "admin.exam_packages.create", "exam_package", id, gin.H{"name": name, "code": code, "isHidden": hidden})
			c.JSON(http.StatusOK, CreateAdminExamPackageResponse{ID: id})
		})

		r.PATCH("/admin/exam-packages/:examPackageId", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			examPackageID := strings.TrimSpace(c.Param("examPackageId"))
			if examPackageID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
				return
			}

			var req UpdateAdminExamPackageRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			set := []string{"updated_at=now()"}
			args := []any{}
			idx := 1
			if req.Name != nil {
				v := strings.TrimSpace(*req.Name)
				if v == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "name cannot be empty"})
					return
				}
				set = append(set, "name="+sqlParam(idx))
				args = append(args, v)
				idx++
			}
			if req.Subtitle != nil {
				set = append(set, "subtitle="+sqlParam(idx))
				args = append(args, strings.TrimSpace(*req.Subtitle))
				idx++
			}
			if req.Overview != nil {
				set = append(set, "overview="+sqlParam(idx))
				args = append(args, strings.TrimSpace(*req.Overview))
				idx++
			}
			if req.Modules != nil {
				v := *req.Modules
				if v == nil {
					v = []string{}
				}
				b, _ := json.Marshal(v)
				set = append(set, "modules="+sqlParam(idx))
				args = append(args, b)
				idx++
			}
			if req.Highlights != nil {
				v := *req.Highlights
				if v == nil {
					v = []string{}
				}
				b, _ := json.Marshal(v)
				set = append(set, "highlights="+sqlParam(idx))
				args = append(args, b)
				idx++
			}
			if req.ModuleSections != nil {
				v := *req.ModuleSections
				if v == nil {
					v = []ExamPackageModuleSection{}
				}
				b, _ := json.Marshal(v)
				set = append(set, "module_sections="+sqlParam(idx))
				args = append(args, b)
				idx++
			}
			if req.IsHidden != nil {
				set = append(set, "is_hidden="+sqlParam(idx))
				args = append(args, *req.IsHidden)
				idx++
			}
			if len(set) == 1 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "no fields to update"})
				return
			}
			args = append(args, examPackageID)

			ct, err := pool.Exec(context.Background(), "update exam_packages set "+strings.Join(set, ", ")+" where id="+sqlParam(idx), args...)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update exam package"})
				return
			}
			if ct.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "exam package not found"})
				return
			}
			audit(context.Background(), pool, actorUserID, actorRole, "admin.exam_packages.update", "exam_package", examPackageID, req)
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		r.DELETE("/admin/exam-packages/:examPackageId", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			examPackageID := strings.TrimSpace(c.Param("examPackageId"))
			if examPackageID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
				return
			}

			ct, err := pool.Exec(context.Background(), `delete from exam_packages where id=$1`, examPackageID)
			if err != nil {
				c.JSON(http.StatusConflict, gin.H{"message": "failed to delete exam package"})
				return
			}
			if ct.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "exam package not found"})
				return
			}
			audit(context.Background(), pool, actorUserID, actorRole, "admin.exam_packages.delete", "exam_package", examPackageID, nil)
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		// Exam package tiers (admin-only CRUD)
		r.GET("/admin/exam-packages/:examPackageId/tiers", adminAuth, func(c *gin.Context) {
			examPackageID := strings.TrimSpace(c.Param("examPackageId"))
			if examPackageID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
				return
			}

			rows, err := pool.Query(context.Background(), `
				select
					id::text,
					exam_package_id::text,
					code,
					name,
					sort_order,
					is_default,
					is_active,
					policy,
					created_at,
					updated_at
				from exam_package_tiers
				where exam_package_id=$1
				order by sort_order asc, created_at asc`, examPackageID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list tiers"})
				return
			}
			defer rows.Close()

			items := []AdminExamPackageTier{}
			for rows.Next() {
				var id, pkgID, code, name string
				var sortOrder int
				var isDefault bool
				var isActive bool
				var policy json.RawMessage
				var createdAt time.Time
				var updatedAt time.Time
				if err := rows.Scan(&id, &pkgID, &code, &name, &sortOrder, &isDefault, &isActive, &policy, &createdAt, &updatedAt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list tiers"})
					return
				}
				if len(policy) == 0 {
					policy = json.RawMessage(`{}`)
				}
				items = append(items, AdminExamPackageTier{
					ID:            id,
					ExamPackageID: pkgID,
					Code:          code,
					Name:          name,
					SortOrder:     sortOrder,
					IsDefault:     isDefault,
					IsActive:      isActive,
					Policy:        policy,
					CreatedAt:     createdAt.UTC().Format(time.RFC3339),
					UpdatedAt:     updatedAt.UTC().Format(time.RFC3339),
				})
			}
			c.JSON(http.StatusOK, ListAdminExamPackageTiersResponse{Items: items})
		})

		r.POST("/admin/exam-packages/:examPackageId/tiers", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			examPackageID := strings.TrimSpace(c.Param("examPackageId"))
			if examPackageID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
				return
			}

			var req CreateAdminExamPackageTierRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			code := strings.TrimSpace(req.Code)
			name := strings.TrimSpace(req.Name)
			if code == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "code is required"})
				return
			}
			if name == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
				return
			}

			policy := json.RawMessage(`{}`)
			if req.Policy != nil {
				if !json.Valid(*req.Policy) {
					c.JSON(http.StatusBadRequest, gin.H{"message": "policy must be valid json"})
					return
				}
				policy = *req.Policy
				if len(policy) == 0 {
					policy = json.RawMessage(`{}`)
				}
			}

			isActive := true
			if req.IsActive != nil {
				isActive = *req.IsActive
			}

			ctx := context.Background()
			tx, err := pool.Begin(ctx)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create tier"})
				return
			}
			defer tx.Rollback(ctx)

			var pkgExists bool
			if err := tx.QueryRow(ctx, `select exists(select 1 from exam_packages where id=$1)`, examPackageID).Scan(&pkgExists); err != nil || !pkgExists {
				c.JSON(http.StatusNotFound, gin.H{"message": "exam package not found"})
				return
			}

			sortOrder := 0
			if req.SortOrder != nil {
				sortOrder = *req.SortOrder
			} else {
				_ = tx.QueryRow(ctx, `select coalesce(max(sort_order), 0) + 1 from exam_package_tiers where exam_package_id=$1`, examPackageID).Scan(&sortOrder)
			}

			var newID string
			err = tx.QueryRow(ctx, `
				insert into exam_package_tiers (exam_package_id, code, name, sort_order, is_default, is_active, policy)
				values ($1, $2, $3, $4, false, $5, $6)
				returning id::text`, examPackageID, code, name, sortOrder, isActive, policy).Scan(&newID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create tier"})
				return
			}

			// Default handling: if caller requested default, or package has no default, make this tier default.
			makeDefault := false
			if req.IsDefault != nil && *req.IsDefault {
				makeDefault = true
			} else {
				var hasDefault bool
				_ = tx.QueryRow(ctx, `select exists(select 1 from exam_package_tiers where exam_package_id=$1 and is_default=true)`, examPackageID).Scan(&hasDefault)
				if !hasDefault {
					makeDefault = true
				}
			}
			if makeDefault {
				_, _ = tx.Exec(ctx, `update exam_package_tiers set is_default=false where exam_package_id=$1 and id<>$2`, examPackageID, newID)
				_, _ = tx.Exec(ctx, `update exam_package_tiers set is_default=true where id=$1`, newID)
			}

			if err := tx.Commit(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create tier"})
				return
			}

			audit(ctx, pool, actorUserID, actorRole, "admin.exam_package_tiers.create", "exam_package_tier", newID, gin.H{"examPackageId": examPackageID, "code": code, "name": name})
			c.JSON(http.StatusOK, CreateAdminExamPackageTierResponse{ID: newID})
		})

		r.PATCH("/admin/exam-packages/:examPackageId/tiers/:tierId", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			examPackageID := strings.TrimSpace(c.Param("examPackageId"))
			tierID := strings.TrimSpace(c.Param("tierId"))
			if examPackageID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
				return
			}
			if tierID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "tierId is required"})
				return
			}

			var req UpdateAdminExamPackageTierRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			ctx := context.Background()
			tx, err := pool.Begin(ctx)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update tier"})
				return
			}
			defer tx.Rollback(ctx)

			var exists bool
			var currentIsDefault bool
			if err := tx.QueryRow(ctx, `select is_default from exam_package_tiers where id=$1 and exam_package_id=$2`, tierID, examPackageID).Scan(&currentIsDefault); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "tier not found"})
				return
			}
			exists = true
			_ = exists

			if req.IsDefault != nil && !*req.IsDefault && currentIsDefault {
				c.JSON(http.StatusBadRequest, gin.H{"message": "cannot unset default tier; set another default tier first"})
				return
			}
			if req.IsActive != nil && !*req.IsActive && currentIsDefault {
				c.JSON(http.StatusBadRequest, gin.H{"message": "cannot deactivate the default tier; set another default tier first"})
				return
			}

			set := []string{"updated_at=now()"}
			args := []any{}
			idx := 1

			if req.Code != nil {
				v := strings.TrimSpace(*req.Code)
				if v == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "code cannot be empty"})
					return
				}
				set = append(set, "code="+sqlParam(idx))
				args = append(args, v)
				idx++
			}
			if req.Name != nil {
				v := strings.TrimSpace(*req.Name)
				if v == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "name cannot be empty"})
					return
				}
				set = append(set, "name="+sqlParam(idx))
				args = append(args, v)
				idx++
			}
			if req.SortOrder != nil {
				set = append(set, "sort_order="+sqlParam(idx))
				args = append(args, *req.SortOrder)
				idx++
			}
			if req.IsActive != nil {
				set = append(set, "is_active="+sqlParam(idx))
				args = append(args, *req.IsActive)
				idx++
			}
			if req.Policy != nil {
				if !json.Valid(*req.Policy) {
					c.JSON(http.StatusBadRequest, gin.H{"message": "policy must be valid json"})
					return
				}
				v := *req.Policy
				if len(v) == 0 {
					v = json.RawMessage(`{}`)
				}
				set = append(set, "policy="+sqlParam(idx))
				args = append(args, v)
				idx++
			}

			if len(set) == 1 && (req.IsDefault == nil) {
				c.JSON(http.StatusBadRequest, gin.H{"message": "no fields to update"})
				return
			}

			if len(set) > 1 {
				args = append(args, tierID, examPackageID)
				ct, err := tx.Exec(ctx, "update exam_package_tiers set "+strings.Join(set, ", ")+" where id="+sqlParam(idx)+" and exam_package_id="+sqlParam(idx+1), args...)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update tier"})
					return
				}
				if ct.RowsAffected() == 0 {
					c.JSON(http.StatusNotFound, gin.H{"message": "tier not found"})
					return
				}
			}

			if req.IsDefault != nil && *req.IsDefault {
				_, _ = tx.Exec(ctx, `update exam_package_tiers set is_default=false where exam_package_id=$1 and id<>$2`, examPackageID, tierID)
				_, _ = tx.Exec(ctx, `update exam_package_tiers set is_default=true where id=$1`, tierID)
			}

			if err := tx.Commit(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update tier"})
				return
			}
			audit(ctx, pool, actorUserID, actorRole, "admin.exam_package_tiers.update", "exam_package_tier", tierID, req)
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		r.DELETE("/admin/exam-packages/:examPackageId/tiers/:tierId", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			examPackageID := strings.TrimSpace(c.Param("examPackageId"))
			tierID := strings.TrimSpace(c.Param("tierId"))
			if examPackageID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
				return
			}
			if tierID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "tierId is required"})
				return
			}

			ctx := context.Background()
			var isDefault bool
			if err := pool.QueryRow(ctx, `select is_default from exam_package_tiers where id=$1 and exam_package_id=$2`, tierID, examPackageID).Scan(&isDefault); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "tier not found"})
				return
			}
			if isDefault {
				c.JSON(http.StatusBadRequest, gin.H{"message": "cannot delete the default tier"})
				return
			}

			ct, err := pool.Exec(ctx, `delete from exam_package_tiers where id=$1 and exam_package_id=$2`, tierID, examPackageID)
			if err != nil {
				c.JSON(http.StatusConflict, gin.H{"message": "failed to delete tier"})
				return
			}
			if ct.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "tier not found"})
				return
			}
			audit(ctx, pool, actorUserID, actorRole, "admin.exam_package_tiers.delete", "exam_package_tier", tierID, gin.H{"examPackageId": examPackageID})
			c.JSON(http.StatusOK, gin.H{"success": true})
		})
	}

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

		// Auth sessions + session limits
		r.GET("/admin/users/:userId/auth-sessions", adminAuth, func(c *gin.Context) {
			userID := c.Param("userId")
			limit, offset := parseListParams(c)
			includeRevoked := parseBoolQuery(c, "includeRevoked")

			where := []string{"user_id=" + sqlParam(1)}
			args := []any{userID}
			if !includeRevoked {
				where = append(where, "revoked_at is null", "expires_at > now()")
			}

			query := `select id, role, audience, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at, revoked_reason
				from auth_sessions
				where ` + strings.Join(where, " and ") +
				` order by created_at desc limit ` + sqlParam(len(args)+1) + ` offset ` + sqlParam(len(args)+2)
			args = append(args, limit+1, offset)

			rows, err := pool.Query(context.Background(), query, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list sessions"})
				return
			}
			defer rows.Close()

			items := make([]AdminAuthSessionListItem, 0, limit)
			for rows.Next() {
				var id, role, audience, ip, ua, revokedReason string
				var createdAt, lastSeenAt, expiresAt time.Time
				var revokedAt *time.Time
				if err := rows.Scan(&id, &role, &audience, &ip, &ua, &createdAt, &lastSeenAt, &expiresAt, &revokedAt, &revokedReason); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list sessions"})
					return
				}
				var revokedAtStr *string
				if revokedAt != nil {
					v := revokedAt.UTC().Format(time.RFC3339)
					revokedAtStr = &v
				}
				items = append(items, AdminAuthSessionListItem{
					ID:            id,
					Role:          role,
					Audience:      audience,
					IP:            ip,
					UserAgent:     ua,
					CreatedAt:     createdAt.UTC().Format(time.RFC3339),
					LastSeenAt:    lastSeenAt.UTC().Format(time.RFC3339),
					ExpiresAt:     expiresAt.UTC().Format(time.RFC3339),
					RevokedAt:     revokedAtStr,
					RevokedReason: revokedReason,
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
			c.JSON(http.StatusOK, ListAdminAuthSessionsResponse{Items: items, Limit: limit, Offset: offset, HasMore: hasMore})
		})

		r.POST("/admin/users/:userId/auth-sessions/revoke-all", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)
			userID := c.Param("userId")

			ctx := context.Background()
			_, _ = pool.Exec(ctx, `update auth_sessions set revoked_at=now(), revoked_reason='admin_revoke_all' where user_id=$1 and revoked_at is null`, userID)
			_, _ = pool.Exec(ctx, `update auth_refresh_tokens set revoked_at=now() where session_id in (select id from auth_sessions where user_id=$1) and revoked_at is null`, userID)

			audit(ctx, pool, actorUserID, actorRole, "auth_sessions.revoke_all", "user", userID, nil)
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.POST("/admin/users/:userId/auth-sessions/:sessionId/revoke", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)
			userID := c.Param("userId")
			sessionID := c.Param("sessionId")

			ctx := context.Background()
			var exists bool
			_ = pool.QueryRow(ctx, `select true from auth_sessions where id=$1 and user_id=$2`, sessionID, userID).Scan(&exists)
			if !exists {
				c.JSON(http.StatusNotFound, gin.H{"message": "session not found"})
				return
			}
			revokeAuthSession(ctx, pool, sessionID, "admin_revoke")
			audit(ctx, pool, actorUserID, actorRole, "auth_sessions.revoke", "auth_session", sessionID, gin.H{"userId": userID})
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.GET("/admin/users/:userId/session-limit", adminAuth, func(c *gin.Context) {
			userID := c.Param("userId")
			ctx := context.Background()

			// Load user's role (used for role-based default).
			var role string
			err := pool.QueryRow(ctx, `select role from users where id=$1`, userID).Scan(&role)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "user not found"})
				return
			}

			var userLimit *int
			var uv int
			if err := pool.QueryRow(ctx, `select max_active_sessions from auth_session_limits_user where user_id=$1`, userID).Scan(&uv); err == nil {
				vv := uv
				userLimit = &vv
			}

			var groupLimit *int
			var gv int
			if err := pool.QueryRow(ctx, `
				select coalesce(min(l.max_active_sessions), 0)
				from auth_session_limits_group l
				join auth_session_group_memberships m on m.group_id=l.group_id
				where m.user_id=$1`, userID).Scan(&gv); err == nil && gv > 0 {
				vv := gv
				groupLimit = &vv
			}

			var roleLimit *int
			var rv int
			if err := pool.QueryRow(ctx, `select max_active_sessions from auth_session_limits_role where role=$1`, role).Scan(&rv); err == nil {
				vv := rv
				roleLimit = &vv
			}

			effective := 3
			if userLimit != nil {
				effective = clampMaxSessions(*userLimit)
			} else if groupLimit != nil {
				effective = clampMaxSessions(*groupLimit)
			} else if roleLimit != nil {
				effective = clampMaxSessions(*roleLimit)
			}

			c.JSON(http.StatusOK, AdminUserSessionLimitResponse{
				EffectiveMaxActiveSessions: effective,
				UserMaxActiveSessions:      userLimit,
				GroupMaxActiveSessions:     groupLimit,
				RoleMaxActiveSessions:      roleLimit,
			})
		})

		r.PUT("/admin/users/:userId/session-limit", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)
			userID := c.Param("userId")
			var req AdminSetUserSessionLimitRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			ctx := context.Background()

			if req.MaxActiveSessions == nil {
				_, _ = pool.Exec(ctx, `delete from auth_session_limits_user where user_id=$1`, userID)
				audit(ctx, pool, actorUserID, actorRole, "auth_limits.user.clear", "user", userID, nil)
				c.JSON(http.StatusOK, gin.H{"ok": true})
				return
			}
			v := clampMaxSessions(*req.MaxActiveSessions)
			_, err := pool.Exec(ctx, `insert into auth_session_limits_user (user_id, max_active_sessions) values ($1,$2)
				on conflict (user_id) do update set max_active_sessions=excluded.max_active_sessions`, userID, v)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to set user limit"})
				return
			}
			audit(ctx, pool, actorUserID, actorRole, "auth_limits.user.set", "user", userID, gin.H{"maxActiveSessions": v})
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		// Session groups (minimal CRUD + membership)
		r.GET("/admin/session-groups", adminAuth, func(c *gin.Context) {
			ctx := context.Background()
			rows, err := pool.Query(ctx, `
				select g.id, g.name, l.max_active_sessions
				from auth_session_groups g
				left join auth_session_limits_group l on l.group_id=g.id
				order by g.name asc`)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list groups"})
				return
			}
			defer rows.Close()

			items := []AdminSessionGroupListItem{}
			for rows.Next() {
				var id, name string
				var lim *int
				if err := rows.Scan(&id, &name, &lim); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list groups"})
					return
				}
				items = append(items, AdminSessionGroupListItem{ID: id, Name: name, MaxActiveSessions: lim})
			}
			c.JSON(http.StatusOK, ListAdminSessionGroupsResponse{Items: items})
		})

		r.POST("/admin/session-groups", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)
			var req CreateAdminSessionGroupRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			name := strings.TrimSpace(req.Name)
			if name == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
				return
			}
			ctx := context.Background()
			groupID := util.NewID("asg")
			_, err := pool.Exec(ctx, `insert into auth_session_groups (id, name) values ($1,$2)`, groupID, name)
			if err != nil {
				var pgerr *pgconn.PgError
				if errors.As(err, &pgerr) && pgerr.Code == "23505" {
					c.JSON(http.StatusConflict, gin.H{"message": "group name already exists"})
					return
				}
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create group"})
				return
			}
			if req.MaxActiveSessions != nil {
				v := clampMaxSessions(*req.MaxActiveSessions)
				_, _ = pool.Exec(ctx, `insert into auth_session_limits_group (group_id, max_active_sessions) values ($1,$2)`, groupID, v)
			}
			audit(ctx, pool, actorUserID, actorRole, "auth_groups.create", "auth_session_group", groupID, gin.H{"name": name})
			c.JSON(http.StatusOK, gin.H{"id": groupID})
		})

		r.PATCH("/admin/session-groups/:groupId", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)
			groupID := c.Param("groupId")
			var req UpdateAdminSessionGroupRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			ctx := context.Background()
			if req.Name != nil {
				name := strings.TrimSpace(*req.Name)
				if name == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "name cannot be empty"})
					return
				}
				cmd, err := pool.Exec(ctx, `update auth_session_groups set name=$2 where id=$1`, groupID, name)
				if err != nil {
					var pgerr *pgconn.PgError
					if errors.As(err, &pgerr) && pgerr.Code == "23505" {
						c.JSON(http.StatusConflict, gin.H{"message": "group name already exists"})
						return
					}
					c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update group"})
					return
				}
				if cmd.RowsAffected() == 0 {
					c.JSON(http.StatusNotFound, gin.H{"message": "group not found"})
					return
				}
			}
			if req.MaxActiveSessions == nil {
				// no-op
			} else {
				v := clampMaxSessions(*req.MaxActiveSessions)
				_, _ = pool.Exec(ctx, `insert into auth_session_limits_group (group_id, max_active_sessions) values ($1,$2)
					on conflict (group_id) do update set max_active_sessions=excluded.max_active_sessions`, groupID, v)
			}
			audit(ctx, pool, actorUserID, actorRole, "auth_groups.update", "auth_session_group", groupID, nil)
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.POST("/admin/session-groups/:groupId/members", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)
			groupID := c.Param("groupId")
			var req AddAdminSessionGroupMemberRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			userID := strings.TrimSpace(req.UserID)
			if userID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "userId is required"})
				return
			}
			ctx := context.Background()
			_, err := pool.Exec(ctx, `insert into auth_session_group_memberships (group_id, user_id) values ($1,$2) on conflict do nothing`, groupID, userID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to add member"})
				return
			}
			audit(ctx, pool, actorUserID, actorRole, "auth_groups.add_member", "auth_session_group", groupID, gin.H{"userId": userID})
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.DELETE("/admin/session-groups/:groupId/members/:userId", adminAuth, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)
			groupID := c.Param("groupId")
			userID := c.Param("userId")
			ctx := context.Background()
			_, _ = pool.Exec(ctx, `delete from auth_session_group_memberships where group_id=$1 and user_id=$2`, groupID, userID)
			audit(ctx, pool, actorUserID, actorRole, "auth_groups.remove_member", "auth_session_group", groupID, gin.H{"userId": userID})
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.GET("/admin/users/:userId/session-groups", adminAuth, func(c *gin.Context) {
			userID := c.Param("userId")
			ctx := context.Background()
			rows, err := pool.Query(ctx, `
				select g.id, g.name, l.max_active_sessions
				from auth_session_group_memberships m
				join auth_session_groups g on g.id=m.group_id
				left join auth_session_limits_group l on l.group_id=g.id
				where m.user_id=$1
				order by g.name asc`, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list user groups"})
				return
			}
			defer rows.Close()
			items := []AdminSessionGroupListItem{}
			for rows.Next() {
				var id, name string
				var lim *int
				if err := rows.Scan(&id, &name, &lim); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list user groups"})
					return
				}
				items = append(items, AdminSessionGroupListItem{ID: id, Name: name, MaxActiveSessions: lim})
			}
			c.JSON(http.StatusOK, ListAdminSessionGroupsResponse{Items: items})
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

