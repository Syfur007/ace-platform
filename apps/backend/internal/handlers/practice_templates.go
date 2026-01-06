package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/apps/backend/internal/auth"
)

type PracticeTemplate struct {
	ID             string  `json:"id"`
	ExamPackageID  string  `json:"examPackageId"`
	Name           string  `json:"name"`
	Section        string  `json:"section"`
	TopicID        *string `json:"topicId"`
	TopicName      *string `json:"topicName"`
	DifficultyID   *string `json:"difficultyId"`
	DifficultyName *string `json:"difficultyName"`
	IsTimed        bool    `json:"isTimed"`
	TargetCount    int     `json:"targetCount"`
	SortOrder      int     `json:"sortOrder"`
	IsPublished    bool    `json:"isPublished"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
}

type ListPracticeTemplatesResponse struct {
	Items []PracticeTemplate `json:"items"`
}

type CreatePracticeTemplateRequest struct {
	ExamPackageID string  `json:"examPackageId"`
	Name          string  `json:"name"`
	Section       string  `json:"section"`
	TopicID       *string `json:"topicId"`
	DifficultyID  *string `json:"difficultyId"`
	IsTimed       bool    `json:"isTimed"`
	TargetCount   int     `json:"targetCount"`
	SortOrder     *int    `json:"sortOrder"`
}

type UpdatePracticeTemplateRequest struct {
	Name         *string `json:"name"`
	Section      *string `json:"section"`
	TopicID      *string `json:"topicId"`
	DifficultyID *string `json:"difficultyId"`
	IsTimed      *bool   `json:"isTimed"`
	TargetCount  *int    `json:"targetCount"`
	SortOrder    *int    `json:"sortOrder"`
}

func registerPracticeTemplateRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	// Student: list published practice templates for enrolled packages.
	r.GET("/practice-templates", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		examPackageID := strings.TrimSpace(c.Query("examPackageId"))
		ctx := context.Background()

		args := []any{userID}
		where := ""
		if examPackageID != "" {
			// Must be enrolled in requested package.
			var enrolled bool
			if err := pool.QueryRow(ctx, `select exists(select 1 from user_exam_package_enrollments where user_id=$1 and exam_package_id=$2)`, userID, examPackageID).Scan(&enrolled); err != nil || !enrolled {
				c.JSON(http.StatusForbidden, gin.H{"message": "not enrolled"})
				return
			}
			where = " and t.exam_package_id = $2"
			args = append(args, examPackageID)
		}

		rows, err := pool.Query(ctx, `
			select
				t.id,
				t.exam_package_id,
				t.name,
				t.section,
				t.topic_id,
				t.difficulty_id,
				t.is_timed,
				t.target_count,
				t.sort_order,
				t.is_published,
				t.created_at,
				t.updated_at,
				tp.name as topic_name,
				d.display_name as difficulty_name
			from practice_templates t
			join user_exam_package_enrollments e on e.exam_package_id = t.exam_package_id and e.user_id = $1
			left join question_bank_topics tp on tp.id = t.topic_id
			left join question_bank_difficulties d on d.id = t.difficulty_id
			where t.is_published = true`+where+`
			order by t.exam_package_id asc, t.section asc, t.sort_order asc, t.created_at desc`, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list practice templates"})
			return
		}
		defer rows.Close()

		items := []PracticeTemplate{}
		for rows.Next() {
			var id string
			var pkgID string
			var name string
			var section string
			var topicID *string
			var difficultyID *string
			var isTimed bool
			var targetCount int
			var sortOrder int
			var isPublished bool
			var createdAt time.Time
			var updatedAt time.Time
			var topicName *string
			var difficultyName *string

			if err := rows.Scan(
				&id,
				&pkgID,
				&name,
				&section,
				&topicID,
				&difficultyID,
				&isTimed,
				&targetCount,
				&sortOrder,
				&isPublished,
				&createdAt,
				&updatedAt,
				&topicName,
				&difficultyName,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list practice templates"})
				return
			}

			items = append(items, PracticeTemplate{
				ID:             id,
				ExamPackageID:  pkgID,
				Name:           name,
				Section:        section,
				TopicID:        topicID,
				TopicName:      topicName,
				DifficultyID:   difficultyID,
				DifficultyName: difficultyName,
				IsTimed:        isTimed,
				TargetCount:    targetCount,
				SortOrder:      sortOrder,
				IsPublished:    isPublished,
				CreatedAt:      createdAt.UTC().Format(time.RFC3339),
				UpdatedAt:      updatedAt.UTC().Format(time.RFC3339),
			})
		}

		c.JSON(http.StatusOK, ListPracticeTemplatesResponse{Items: items})
	})

	// Instructor/admin management.
	{
		requireInstructorOrAdmin := authRequireRolesAndAudiences(pool, []string{"instructor", "admin"}, []string{"instructor", "admin"})

		r.GET("/instructor/practice-templates", requireInstructorOrAdmin, func(c *gin.Context) {
			examPackageID := strings.TrimSpace(c.Query("examPackageId"))
			includeUnpublished := true
			if v := strings.TrimSpace(c.Query("includeUnpublished")); v != "" {
				if parsed, err := strconv.ParseBool(v); err == nil {
					includeUnpublished = parsed
				}
			}

			ctx := context.Background()
			args := []any{}
			where := "where 1=1"
			if examPackageID != "" {
				args = append(args, examPackageID)
				where += " and t.exam_package_id = $" + strconv.Itoa(len(args))
			}
			if !includeUnpublished {
				where += " and t.is_published = true"
			}

			rows, err := pool.Query(ctx, `
				select
					t.id,
					t.exam_package_id,
					t.name,
					t.section,
					t.topic_id,
					t.difficulty_id,
					t.is_timed,
					t.target_count,
					t.sort_order,
					t.is_published,
					t.created_at,
					t.updated_at,
					tp.name as topic_name,
					d.display_name as difficulty_name
				from practice_templates t
				left join question_bank_topics tp on tp.id = t.topic_id
				left join question_bank_difficulties d on d.id = t.difficulty_id
				`+where+`
				order by t.exam_package_id asc, t.section asc, t.sort_order asc, t.created_at desc`, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list practice templates"})
				return
			}

			items := []PracticeTemplate{}
			for rows.Next() {
				var id string
				var pkgID string
				var name string
				var section string
				var topicID *string
				var difficultyID *string
				var isTimed bool
				var targetCount int
				var sortOrder int
				var isPublished bool
				var createdAt time.Time
				var updatedAt time.Time
				var topicName *string
				var difficultyName *string

				if err := rows.Scan(
					&id,
					&pkgID,
					&name,
					&section,
					&topicID,
					&difficultyID,
					&isTimed,
					&targetCount,
					&sortOrder,
					&isPublished,
					&createdAt,
					&updatedAt,
					&topicName,
					&difficultyName,
				); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list practice templates"})
					return
				}

				items = append(items, PracticeTemplate{
					ID:             id,
					ExamPackageID:  pkgID,
					Name:           name,
					Section:        section,
					TopicID:        topicID,
					TopicName:      topicName,
					DifficultyID:   difficultyID,
					DifficultyName: difficultyName,
					IsTimed:        isTimed,
					TargetCount:    targetCount,
					SortOrder:      sortOrder,
					IsPublished:    isPublished,
					CreatedAt:      createdAt.UTC().Format(time.RFC3339),
					UpdatedAt:      updatedAt.UTC().Format(time.RFC3339),
				})
			}

			c.JSON(http.StatusOK, ListPracticeTemplatesResponse{Items: items})
		})

		r.POST("/instructor/practice-templates", requireInstructorOrAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}

			var req CreatePracticeTemplateRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			examPkgID := strings.TrimSpace(req.ExamPackageID)
			name := strings.TrimSpace(req.Name)
			section := strings.TrimSpace(req.Section)
			if examPkgID == "" || name == "" || section == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId, name, and section are required"})
				return
			}
			if req.TargetCount < 1 {
				req.TargetCount = 10
			}
			if req.TargetCount > 50 {
				req.TargetCount = 50
			}
			sortOrder := 0
			if req.SortOrder != nil && *req.SortOrder >= 0 {
				sortOrder = *req.SortOrder
			}

			ctx := context.Background()
			_, err := pool.Exec(ctx, `
				insert into practice_templates (
					exam_package_id, name, section, topic_id, difficulty_id, is_timed, target_count, sort_order, is_published,
					created_by_user_id, updated_by_user_id
				)
				values ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$9)`,
				examPkgID, name, section, req.TopicID, req.DifficultyID, req.IsTimed, req.TargetCount, sortOrder, userID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create template"})
				return
			}

			// Return newest template matching (best-effort).
			row := pool.QueryRow(ctx, `
				select
					t.id,
					t.exam_package_id,
					t.name,
					t.section,
					t.topic_id,
					t.difficulty_id,
					t.is_timed,
					t.target_count,
					t.sort_order,
					t.is_published,
					t.created_at,
					t.updated_at,
					tp.name as topic_name,
					d.display_name as difficulty_name
				from practice_templates t
				left join question_bank_topics tp on tp.id = t.topic_id
				left join question_bank_difficulties d on d.id = t.difficulty_id
				where t.exam_package_id=$1 and t.created_by_user_id=$2
				order by t.created_at desc
				limit 1`, examPkgID, userID)

			var out PracticeTemplate
			var createdAt time.Time
			var updatedAt time.Time
			if err := row.Scan(
				&out.ID,
				&out.ExamPackageID,
				&out.Name,
				&out.Section,
				&out.TopicID,
				&out.DifficultyID,
				&out.IsTimed,
				&out.TargetCount,
				&out.SortOrder,
				&out.IsPublished,
				&createdAt,
				&updatedAt,
				&out.TopicName,
				&out.DifficultyName,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "created but failed to load"})
				return
			}
			out.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			out.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

			c.JSON(http.StatusOK, out)
		})

		r.PATCH("/instructor/practice-templates/:templateId", requireInstructorOrAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}

			id := strings.TrimSpace(c.Param("templateId"))
			if id == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "templateId is required"})
				return
			}

			var req UpdatePracticeTemplateRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			ctx := context.Background()

			// Update with COALESCE to keep patch semantics.
			_, err := pool.Exec(ctx, `
				update practice_templates set
					name = coalesce($2, name),
					section = coalesce($3, section),
					topic_id = $4,
					difficulty_id = $5,
					is_timed = coalesce($6, is_timed),
					target_count = coalesce($7, target_count),
					sort_order = coalesce($8, sort_order),
					updated_by_user_id = $9,
					updated_at = now()
				where id=$1`,
				id,
				nilIfEmptyPtr(req.Name),
				nilIfEmptyPtr(req.Section),
				req.TopicID,
				req.DifficultyID,
				req.IsTimed,
				req.TargetCount,
				req.SortOrder,
				userID,
			)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update template"})
				return
			}

			row := pool.QueryRow(ctx, `
				select
					t.id,
					t.exam_package_id,
					t.name,
					t.section,
					t.topic_id,
					t.difficulty_id,
					t.is_timed,
					t.target_count,
					t.sort_order,
					t.is_published,
					t.created_at,
					t.updated_at,
					tp.name as topic_name,
					d.display_name as difficulty_name
				from practice_templates t
				left join question_bank_topics tp on tp.id = t.topic_id
				left join question_bank_difficulties d on d.id = t.difficulty_id
				where t.id=$1`, id)

			var out PracticeTemplate
			var createdAt time.Time
			var updatedAt time.Time
			if err := row.Scan(
				&out.ID,
				&out.ExamPackageID,
				&out.Name,
				&out.Section,
				&out.TopicID,
				&out.DifficultyID,
				&out.IsTimed,
				&out.TargetCount,
				&out.SortOrder,
				&out.IsPublished,
				&createdAt,
				&updatedAt,
				&out.TopicName,
				&out.DifficultyName,
			); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "template not found"})
				return
			}
			out.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			out.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

			c.JSON(http.StatusOK, out)
		})

		r.DELETE("/instructor/practice-templates/:templateId", requireInstructorOrAdmin, func(c *gin.Context) {
			id := strings.TrimSpace(c.Param("templateId"))
			if id == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "templateId is required"})
				return
			}
			ctx := context.Background()
			ct, err := pool.Exec(ctx, `delete from practice_templates where id=$1`, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to delete template"})
				return
			}
			if ct.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "template not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		setPublished := func(isPublished bool) gin.HandlerFunc {
			return func(c *gin.Context) {
				id := strings.TrimSpace(c.Param("templateId"))
				if id == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "templateId is required"})
					return
				}

				ctx := context.Background()
				_, err := pool.Exec(ctx, `update practice_templates set is_published=$2, updated_at=now() where id=$1`, id, isPublished)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update publish state"})
					return
				}

				row := pool.QueryRow(ctx, `
					select
						t.id,
						t.exam_package_id,
						t.name,
						t.section,
						t.topic_id,
						t.difficulty_id,
						t.is_timed,
						t.target_count,
						t.sort_order,
						t.is_published,
						t.created_at,
						t.updated_at,
						tp.name as topic_name,
						d.display_name as difficulty_name
					from practice_templates t
					left join question_bank_topics tp on tp.id = t.topic_id
					left join question_bank_difficulties d on d.id = t.difficulty_id
					where t.id=$1`, id)

				var out PracticeTemplate
				var createdAt time.Time
				var updatedAt time.Time
				if err := row.Scan(
					&out.ID,
					&out.ExamPackageID,
					&out.Name,
					&out.Section,
					&out.TopicID,
					&out.DifficultyID,
					&out.IsTimed,
					&out.TargetCount,
					&out.SortOrder,
					&out.IsPublished,
					&createdAt,
					&updatedAt,
					&out.TopicName,
					&out.DifficultyName,
				); err != nil {
					c.JSON(http.StatusNotFound, gin.H{"message": "template not found"})
					return
				}
				out.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				out.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

				c.JSON(http.StatusOK, out)
			}
		}

		r.POST("/instructor/practice-templates/:templateId/publish", requireInstructorOrAdmin, setPublished(true))
		r.POST("/instructor/practice-templates/:templateId/unpublish", requireInstructorOrAdmin, setPublished(false))
	}
}

func nilIfEmptyPtr(in *string) *string {
	if in == nil {
		return nil
	}
	v := strings.TrimSpace(*in)
	if v == "" {
		return nil
	}
	return &v
}
