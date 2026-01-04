package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
	"github.com/ace-platform/api-gateway/internal/util"
)

type QuestionStatus string

const (
	QuestionDraft     QuestionStatus = "draft"
	QuestionInReview  QuestionStatus = "in_review"
	QuestionNeedsChanges QuestionStatus = "needs_changes"
	QuestionPublished QuestionStatus = "published"
	QuestionArchived  QuestionStatus = "archived"
)

type QuestionDifficulty struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
}

type QuestionBank struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	ExamPackageID *string `json:"examPackageId"`
	IsHidden     bool    `json:"isHidden"`
	CreatedAt    string  `json:"createdAt"`
}

type QuestionTopic struct {
	ID        string  `json:"id"`
	QuestionBankID *string `json:"questionBankId"`
	Name      string  `json:"name"`
	IsHidden  bool    `json:"isHidden"`
	CreatedAt string  `json:"createdAt"`
}

type ListQuestionDifficultiesResponse struct {
	Items []QuestionDifficulty `json:"items"`
}

type ListQuestionBanksResponse struct {
	Items []QuestionBank `json:"items"`
}

type ListQuestionTopicsResponse struct {
	Items []QuestionTopic `json:"items"`
}

type PublicQuestionListItem struct {
	ID           string  `json:"id"`
	QuestionBankID    *string `json:"questionBankId"`
	TopicID      *string `json:"topicId"`
	DifficultyID string  `json:"difficultyId"`
	Prompt       string  `json:"prompt"`
}

type ListQuestionsResponse struct {
	Items   []PublicQuestionListItem `json:"items"`
	Limit   int                      `json:"limit"`
	Offset  int                      `json:"offset"`
	HasMore bool                     `json:"hasMore"`
}

type PublicQuestionResponse struct {
	ID           string                  `json:"id"`
	QuestionBankID    *string                 `json:"questionBankId"`
	TopicID      *string                 `json:"topicId"`
	DifficultyID string                  `json:"difficultyId"`
	Prompt       string                  `json:"prompt"`
	Choices      []PracticeQuestionChoice `json:"choices"`
}

type InstructorQuestionResponse struct {
	ID             string                  `json:"id"`
	QuestionBankID      *string                 `json:"questionBankId"`
	TopicID        *string                 `json:"topicId"`
	DifficultyID   string                  `json:"difficultyId"`
	Prompt         string                  `json:"prompt"`
	Explanation    string                  `json:"explanation"`
	Status         QuestionStatus          `json:"status"`
	CorrectChoiceID string                 `json:"correctChoiceId"`
	Choices        []PracticeQuestionChoice `json:"choices"`
	CreatedByUserID string                 `json:"createdByUserId"`
	UpdatedByUserID string                 `json:"updatedByUserId"`
	CreatedAt      string                  `json:"createdAt"`
	UpdatedAt      string                  `json:"updatedAt"`
}

type CreateQuestionRequest struct {
	QuestionBankID    *string `json:"questionBankId"`
	TopicID      *string `json:"topicId"`
	DifficultyID string  `json:"difficultyId"`
	Prompt       string  `json:"prompt"`
	Explanation  string  `json:"explanation"`
	Choices      []struct {
		Text string `json:"text"`
	} `json:"choices"`
	CorrectChoiceIndex int `json:"correctChoiceIndex"`
}

type UpdateQuestionRequest struct {
	QuestionBankID    *string `json:"questionBankId"`
	TopicID      *string `json:"topicId"`
	DifficultyID *string `json:"difficultyId"`
	Prompt       *string `json:"prompt"`
	Explanation  *string `json:"explanation"`
}

type ReplaceChoicesRequest struct {
	Choices []struct {
		Text string `json:"text"`
	} `json:"choices"`
	CorrectChoiceIndex int `json:"correctChoiceIndex"`
}

type CreateQuestionBankRequest struct {
	Name         string `json:"name"`
	ExamPackageID string `json:"examPackageId"`
}

type CreateQuestionTopicRequest struct {
	QuestionBankID *string `json:"questionBankId"`
	Name      string  `json:"name"`
}

type UpdateQuestionBankRequest struct {
	Name         *string `json:"name"`
	ExamPackageID *string `json:"examPackageId"`
	IsHidden      *bool   `json:"isHidden"`
}

type UpdateQuestionTopicRequest struct {
	Name     *string `json:"name"`
	IsHidden *bool   `json:"isHidden"`
}

type UpdateQuestionDifficultyRequest struct {
	DisplayName *string `json:"displayName"`
}

func authRequireRolesAndAudiences(pool *pgxpool.Pool, allowedRoles []string, allowedAudiences []string) gin.HandlerFunc {
	roleAllowed := func(role string) bool {
		for _, r := range allowedRoles {
			if r == role {
				return true
			}
		}
		return false
	}
	audienceAllowed := func(audiences []string) bool {
		for _, a := range audiences {
			for _, allowed := range allowedAudiences {
				if a == allowed {
					return true
				}
			}
		}
		return false
	}

	return func(c *gin.Context) {
		token := ""
		authz := c.GetHeader("Authorization")
		if authz != "" {
			parts := strings.SplitN(authz, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid authorization"})
				return
			}
			token = parts[1]
		} else {
			if v, err := c.Cookie("ace_access"); err == nil {
				token = strings.TrimSpace(v)
			}
		}
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "missing authorization"})
			return
		}

		claims, err := auth.ParseAccessToken(token)
		if err != nil || claims.Subject == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid token"})
			return
		}

		if claims.SessionID != "" && pool != nil {
			var revokedAt *time.Time
			var expiresAt time.Time
			err := pool.QueryRow(context.Background(), `select revoked_at, expires_at from auth_sessions where id=$1 and user_id=$2`, claims.SessionID, claims.Subject).
				Scan(&revokedAt, &expiresAt)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}
			now := time.Now().UTC()
			if revokedAt != nil || !expiresAt.After(now) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}
			_, _ = pool.Exec(context.Background(), `update auth_sessions set last_seen_at=now() where id=$1`, claims.SessionID)
		}

		if len(allowedRoles) > 0 && !roleAllowed(claims.Role) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "forbidden"})
			return
		}

		if len(allowedAudiences) > 0 && !audienceAllowed(claims.Audience) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "forbidden"})
			return
		}

		c.Set(string(auth.UserIDKey), claims.Subject)
		c.Set(string(auth.RoleKey), claims.Role)
		c.Set(string(auth.SessionIDKey), claims.SessionID)
		c.Next()
	}
}

func sqlParam(n int) string {
	return fmt.Sprintf("$%d", n)
}

func RegisterQuestionRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	// Public/student read endpoints
	{
		r.GET("/questions", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
			limit, offset := parseListParams(c)
			questionBankID := strings.TrimSpace(c.Query("questionBankId"))
			topicID := strings.TrimSpace(c.Query("topicId"))
			difficultyID := strings.TrimSpace(c.Query("difficultyId"))

			args := []any{}
			where := []string{"q.status='published'"}

			if questionBankID != "" {
				where = append(where, "q.package_id="+sqlParam(len(args)+1))
				args = append(args, questionBankID)
			}
			if topicID != "" {
				where = append(where, "q.topic_id="+sqlParam(len(args)+1))
				args = append(args, topicID)
			}
			if difficultyID != "" {
				where = append(where, "q.difficulty_id="+sqlParam(len(args)+1))
				args = append(args, difficultyID)
			}

			query := `select q.id, q.package_id, q.topic_id, q.difficulty_id, q.prompt
				from question_bank_questions q`
			if len(where) > 0 {
				query += " where " + strings.Join(where, " and ")
			}
			query += " order by q.created_at desc limit " + sqlParam(len(args)+1) + " offset " + sqlParam(len(args)+2)
			args = append(args, limit+1, offset)

			rows, err := pool.Query(context.Background(), query, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list questions"})
				return
			}
			defer rows.Close()

			items := make([]PublicQuestionListItem, 0, limit)
			for rows.Next() {
				var id string
				var pkg *string
				var top *string
				var diff string
				var prompt string
				if err := rows.Scan(&id, &pkg, &top, &diff, &prompt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list questions"})
					return
				}
				items = append(items, PublicQuestionListItem{ID: id, QuestionBankID: pkg, TopicID: top, DifficultyID: diff, Prompt: prompt})
				if len(items) == limit+1 {
					break
				}
			}

			hasMore := false
			if len(items) > limit {
				hasMore = true
				items = items[:limit]
			}

			c.JSON(http.StatusOK, ListQuestionsResponse{Items: items, Limit: limit, Offset: offset, HasMore: hasMore})
		})

		r.GET("/questions/:questionId", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
			qid := c.Param("questionId")
			ctx := context.Background()

			var id string
			var pkg *string
			var top *string
			var diff string
			var prompt string
			err := pool.QueryRow(ctx, `select id, package_id, topic_id, difficulty_id, prompt from question_bank_questions where id=$1 and status='published'`, qid).
				Scan(&id, &pkg, &top, &diff, &prompt)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
				return
			}

			rows, err := pool.Query(ctx, `select id, text from question_bank_choices where question_id=$1 order by order_index asc`, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load choices"})
				return
			}
			defer rows.Close()

			choices := make([]PracticeQuestionChoice, 0)
			for rows.Next() {
				var cid string
				var text string
				if err := rows.Scan(&cid, &text); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load choices"})
					return
				}
				choices = append(choices, PracticeQuestionChoice{ID: cid, Text: text})
			}

			c.JSON(http.StatusOK, PublicQuestionResponse{ID: id, QuestionBankID: pkg, TopicID: top, DifficultyID: diff, Prompt: prompt, Choices: choices})
		})
	}

	// Reference data (read-only for now)
	{
		r.GET("/question-banks", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
			rows, err := pool.Query(context.Background(), `
				select
					p.id,
					p.name,
					(
						select min(m.exam_package_id::text)
						from exam_package_question_bank_packages m
						where m.question_bank_package_id=p.id
					) as exam_package_id,
					p.is_hidden,
					p.created_at
				from question_bank_packages p
				where p.is_hidden=false
				order by p.name asc`)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list question banks"})
				return
			}
			defer rows.Close()
			items := []QuestionBank{}
			for rows.Next() {
				var id, name string
				var examPackageID *string
				var hidden bool
				var createdAt time.Time
				if err := rows.Scan(&id, &name, &examPackageID, &hidden, &createdAt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list question banks"})
					return
				}
				items = append(items, QuestionBank{ID: id, Name: name, ExamPackageID: examPackageID, IsHidden: hidden, CreatedAt: createdAt.UTC().Format(time.RFC3339)})
			}
			c.JSON(http.StatusOK, ListQuestionBanksResponse{Items: items})
		})

		r.GET("/question-topics", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
			questionBankID := strings.TrimSpace(c.Query("questionBankId"))
			args := []any{}
			query := `select id, package_id, name, is_hidden, created_at from question_bank_topics`
			where := []string{"is_hidden=false"}
			if questionBankID != "" {
				where = append(where, "package_id=$1")
				args = append(args, questionBankID)
			}
			query += " where " + strings.Join(where, " and ")
			query += " order by name asc"

			rows, err := pool.Query(context.Background(), query, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list topics"})
				return
			}
			defer rows.Close()
			items := []QuestionTopic{}
			for rows.Next() {
				var id string
				var pkg *string
				var name string
				var hidden bool
				var createdAt time.Time
				if err := rows.Scan(&id, &pkg, &name, &hidden, &createdAt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list topics"})
					return
				}
				items = append(items, QuestionTopic{ID: id, QuestionBankID: pkg, Name: name, IsHidden: hidden, CreatedAt: createdAt.UTC().Format(time.RFC3339)})
			}
			c.JSON(http.StatusOK, ListQuestionTopicsResponse{Items: items})
		})

		r.GET("/question-difficulties", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
			rows, err := pool.Query(context.Background(), `select id, display_name from question_bank_difficulties order by sort_order asc`)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list difficulties"})
				return
			}
			defer rows.Close()

			out := []QuestionDifficulty{}
			for rows.Next() {
				var id string
				var display string
				if err := rows.Scan(&id, &display); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list difficulties"})
					return
				}
				out = append(out, QuestionDifficulty{ID: id, DisplayName: display})
			}
			c.JSON(http.StatusOK, ListQuestionDifficultiesResponse{Items: out})
		})
	}

	// Instructor/admin write endpoints
	{
		requireInstructorOrAdmin := authRequireRolesAndAudiences(pool, []string{"instructor", "admin"}, []string{"instructor", "admin"})

		r.POST("/instructor/question-banks", requireInstructorOrAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}

			var req CreateQuestionBankRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			name := strings.TrimSpace(req.Name)
			if name == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
				return
			}
			examPkgID := strings.TrimSpace(req.ExamPackageID)
			if examPkgID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
				return
			}
			var examPkgExists bool
			if err := pool.QueryRow(context.Background(), `select exists(select 1 from exam_packages where id=$1)`, examPkgID).Scan(&examPkgExists); err != nil || !examPkgExists {
				c.JSON(http.StatusBadRequest, gin.H{"message": "unknown exam package"})
				return
			}
			pkgID := util.NewID("pkg")

			ctx := context.Background()
			tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create package"})
				return
			}
			defer func() { _ = tx.Rollback(ctx) }()

			_, err = tx.Exec(ctx, `insert into question_bank_packages (id, name, created_by_user_id) values ($1,$2,$3)`, pkgID, name, userID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create question bank"})
				return
			}
			_, err = tx.Exec(ctx, `insert into exam_package_question_bank_packages (exam_package_id, question_bank_package_id) values ($1,$2) on conflict do nothing`, examPkgID, pkgID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create question bank"})
				return
			}

			if err := tx.Commit(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create question bank"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"id": pkgID})
		})

		r.GET("/instructor/question-banks", requireInstructorOrAdmin, func(c *gin.Context) {
			rows, err := pool.Query(context.Background(), `
				select
					p.id,
					p.name,
					(
						select min(m.exam_package_id::text)
						from exam_package_question_bank_packages m
						where m.question_bank_package_id=p.id
					) as exam_package_id,
					p.is_hidden,
					p.created_at
				from question_bank_packages p
				order by p.name asc`)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list question banks"})
				return
			}
			defer rows.Close()
			items := []QuestionBank{}
			for rows.Next() {
				var id, name string
				var examPackageID *string
				var hidden bool
				var createdAt time.Time
				if err := rows.Scan(&id, &name, &examPackageID, &hidden, &createdAt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list question banks"})
					return
				}
				items = append(items, QuestionBank{ID: id, Name: name, ExamPackageID: examPackageID, IsHidden: hidden, CreatedAt: createdAt.UTC().Format(time.RFC3339)})
			}
			c.JSON(http.StatusOK, ListQuestionBanksResponse{Items: items})
		})

		r.PATCH("/instructor/question-banks/:questionBankId", requireInstructorOrAdmin, func(c *gin.Context) {
			pid := strings.TrimSpace(c.Param("questionBankId"))
			if pid == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "questionBankId is required"})
				return
			}

			var req UpdateQuestionBankRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			set := []string{}
			args := []any{}
			idx := 1

			if req.Name != nil {
				name := strings.TrimSpace(*req.Name)
				if name == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "name cannot be empty"})
					return
				}
				set = append(set, "name="+sqlParam(idx))
				args = append(args, name)
				idx++
			}
			if req.IsHidden != nil {
				set = append(set, "is_hidden="+sqlParam(idx))
				args = append(args, *req.IsHidden)
				idx++
			}
			// examPackageId updates are handled by syncing the mapping table below.

			if len(set) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "no fields to update"})
				return
			}

			ctx := context.Background()
			tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update question bank"})
				return
			}
			defer func() { _ = tx.Rollback(ctx) }()

			set = append(set, "updated_at=now()")
			args = append(args, pid)
			_, err = tx.Exec(ctx, "update question_bank_packages set "+strings.Join(set, ", ")+" where id="+sqlParam(idx), args...)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update question bank"})
				return
			}

			// Keep mapping in sync when examPackageId is updated.
			if req.ExamPackageID != nil {
				examPkgID := strings.TrimSpace(*req.ExamPackageID)
				if examPkgID == "" {
					_, err = tx.Exec(ctx, `delete from exam_package_question_bank_packages where question_bank_package_id=$1`, pid)
					if err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update question bank"})
						return
					}
				} else {
					var examPkgExists bool
					if err := tx.QueryRow(ctx, `select exists(select 1 from exam_packages where id=$1)`, examPkgID).Scan(&examPkgExists); err != nil || !examPkgExists {
						c.JSON(http.StatusBadRequest, gin.H{"message": "unknown exam package"})
						return
					}
					_, err = tx.Exec(ctx, `delete from exam_package_question_bank_packages where question_bank_package_id=$1`, pid)
					if err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update question bank"})
						return
					}
					_, err = tx.Exec(ctx, `insert into exam_package_question_bank_packages (exam_package_id, question_bank_package_id) values ($1,$2) on conflict do nothing`, examPkgID, pid)
					if err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update question bank"})
						return
					}
				}
			}

			if err := tx.Commit(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update question bank"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		r.DELETE("/instructor/question-banks/:questionBankId", requireInstructorOrAdmin, func(c *gin.Context) {
			pid := strings.TrimSpace(c.Param("questionBankId"))
			if pid == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "questionBankId is required"})
				return
			}
			ct, err := pool.Exec(context.Background(), `delete from question_bank_packages where id=$1`, pid)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to delete question bank"})
				return
			}
			if ct.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "question bank not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		r.POST("/instructor/question-topics", requireInstructorOrAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}

			var req CreateQuestionTopicRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			name := strings.TrimSpace(req.Name)
			if name == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
				return
			}
			topicID := util.NewID("top")
			_, err := pool.Exec(context.Background(), `insert into question_bank_topics (id, package_id, name, created_by_user_id) values ($1,$2,$3,$4)`, topicID, req.QuestionBankID, name, userID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create topic"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"id": topicID})
		})

		r.GET("/instructor/question-topics", requireInstructorOrAdmin, func(c *gin.Context) {
			questionBankID := strings.TrimSpace(c.Query("questionBankId"))
			args := []any{}
			query := `select id, package_id, name, is_hidden, created_at from question_bank_topics`
			if questionBankID != "" {
				query += " where package_id=$1"
				args = append(args, questionBankID)
			}
			query += " order by name asc"
			rows, err := pool.Query(context.Background(), query, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list topics"})
				return
			}
			defer rows.Close()
			items := []QuestionTopic{}
			for rows.Next() {
				var id string
				var pkg *string
				var name string
				var hidden bool
				var createdAt time.Time
				if err := rows.Scan(&id, &pkg, &name, &hidden, &createdAt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list topics"})
					return
				}
				items = append(items, QuestionTopic{ID: id, QuestionBankID: pkg, Name: name, IsHidden: hidden, CreatedAt: createdAt.UTC().Format(time.RFC3339)})
			}
			c.JSON(http.StatusOK, ListQuestionTopicsResponse{Items: items})
		})

		r.PATCH("/instructor/question-topics/:topicId", requireInstructorOrAdmin, func(c *gin.Context) {
			tid := strings.TrimSpace(c.Param("topicId"))
			if tid == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "topicId is required"})
				return
			}

			var req UpdateQuestionTopicRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			set := []string{}
			args := []any{}
			idx := 1

			if req.Name != nil {
				name := strings.TrimSpace(*req.Name)
				if name == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "name cannot be empty"})
					return
				}
				set = append(set, "name="+sqlParam(idx))
				args = append(args, name)
				idx++
			}
			if req.IsHidden != nil {
				set = append(set, "is_hidden="+sqlParam(idx))
				args = append(args, *req.IsHidden)
				idx++
			}

			if len(set) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "no fields to update"})
				return
			}

			set = append(set, "updated_at=now()")
			args = append(args, tid)
			_, err := pool.Exec(context.Background(), "update question_bank_topics set "+strings.Join(set, ", ")+" where id="+sqlParam(idx), args...)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update topic"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		r.DELETE("/instructor/question-topics/:topicId", requireInstructorOrAdmin, func(c *gin.Context) {
			tid := strings.TrimSpace(c.Param("topicId"))
			if tid == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "topicId is required"})
				return
			}
			ct, err := pool.Exec(context.Background(), `delete from question_bank_topics where id=$1`, tid)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to delete topic"})
				return
			}
			if ct.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "topic not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		r.GET("/instructor/question-difficulties", requireInstructorOrAdmin, func(c *gin.Context) {
			rows, err := pool.Query(context.Background(), `select id, display_name from question_bank_difficulties order by sort_order asc`)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list difficulties"})
				return
			}
			defer rows.Close()

			out := []QuestionDifficulty{}
			for rows.Next() {
				var id string
				var display string
				if err := rows.Scan(&id, &display); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list difficulties"})
					return
				}
				out = append(out, QuestionDifficulty{ID: id, DisplayName: display})
			}
			c.JSON(http.StatusOK, ListQuestionDifficultiesResponse{Items: out})
		})

		r.PATCH("/instructor/question-difficulties/:difficultyId", requireInstructorOrAdmin, func(c *gin.Context) {
		did := strings.TrimSpace(c.Param("difficultyId"))
			if did == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "difficultyId is required"})
				return
			}
			var req UpdateQuestionDifficultyRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			if req.DisplayName == nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "displayName is required"})
				return
			}
			display := strings.TrimSpace(*req.DisplayName)
			if display == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "displayName cannot be empty"})
				return
			}
			ct, err := pool.Exec(context.Background(), `update question_bank_difficulties set display_name=$1 where id=$2`, display, did)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update difficulty"})
				return
			}
			if ct.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "difficulty not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		r.POST("/instructor/questions", requireInstructorOrAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}

			var req CreateQuestionRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			req.Prompt = strings.TrimSpace(req.Prompt)
			req.Explanation = strings.TrimSpace(req.Explanation)
			if req.Prompt == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "prompt is required"})
				return
			}
			if strings.TrimSpace(req.DifficultyID) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "difficultyId is required"})
				return
			}
			if len(req.Choices) < 2 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "at least 2 choices are required"})
				return
			}
			if req.CorrectChoiceIndex < 0 || req.CorrectChoiceIndex >= len(req.Choices) {
				c.JSON(http.StatusBadRequest, gin.H{"message": "correctChoiceIndex out of range"})
				return
			}

			ctx := context.Background()
			tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create question"})
				return
			}
			defer func() { _ = tx.Rollback(ctx) }()

			questionID := util.NewID("qst")
			now := time.Now().UTC()
			_, err = tx.Exec(ctx, `insert into question_bank_questions (id, package_id, topic_id, difficulty_id, prompt, explanation_text, status, created_by_user_id, updated_by_user_id)
				values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
				questionID, req.QuestionBankID, req.TopicID, req.DifficultyID, req.Prompt, req.Explanation, string(QuestionDraft), userID, userID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create question"})
				return
			}

			choices := make([]PracticeQuestionChoice, 0, len(req.Choices))
			choiceIDs := make([]string, 0, len(req.Choices))
			for i, ch := range req.Choices {
				text := strings.TrimSpace(ch.Text)
				if text == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "choice text is required"})
					return
				}
				choiceID := util.NewID("ch")
				_, err = tx.Exec(ctx, `insert into question_bank_choices (id, question_id, order_index, text) values ($1,$2,$3,$4)`, choiceID, questionID, i, text)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create choices"})
					return
				}
				choices = append(choices, PracticeQuestionChoice{ID: choiceID, Text: text})
				choiceIDs = append(choiceIDs, choiceID)
			}

			correctChoiceID := choiceIDs[req.CorrectChoiceIndex]
			_, err = tx.Exec(ctx, `insert into question_bank_correct_choice (question_id, choice_id) values ($1,$2)`, questionID, correctChoiceID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to set correct choice"})
				return
			}

			if err := tx.Commit(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create question"})
				return
			}

			c.JSON(http.StatusOK, InstructorQuestionResponse{
				ID:              questionID,
				QuestionBankID:       req.QuestionBankID,
				TopicID:         req.TopicID,
				DifficultyID:    req.DifficultyID,
				Prompt:          req.Prompt,
				Explanation:     req.Explanation,
				Status:          QuestionDraft,
				CorrectChoiceID: correctChoiceID,
				Choices:         choices,
				CreatedByUserID: userID,
				UpdatedByUserID: userID,
				CreatedAt:       now.Format(time.RFC3339),
				UpdatedAt:       now.Format(time.RFC3339),
			})
		})

		r.GET("/instructor/questions", requireInstructorOrAdmin, func(c *gin.Context) {
			limit, offset := parseListParams(c)
			status := strings.TrimSpace(c.Query("status"))
			questionBankID := strings.TrimSpace(c.Query("questionBankId"))
			topicID := strings.TrimSpace(c.Query("topicId"))
			difficultyID := strings.TrimSpace(c.Query("difficultyId"))

			args := []any{}
			where := []string{"1=1"}
			if status != "" {
				where = append(where, "q.status="+sqlParam(len(args)+1))
				args = append(args, status)
			}
			if questionBankID != "" {
				where = append(where, "q.package_id="+sqlParam(len(args)+1))
				args = append(args, questionBankID)
			}
			if topicID != "" {
				where = append(where, "q.topic_id="+sqlParam(len(args)+1))
				args = append(args, topicID)
			}
			if difficultyID != "" {
				where = append(where, "q.difficulty_id="+sqlParam(len(args)+1))
				args = append(args, difficultyID)
			}

			query := `select q.id, q.package_id, q.topic_id, q.difficulty_id, q.prompt
				from question_bank_questions q where ` + strings.Join(where, " and ") +
				` order by q.updated_at desc limit ` + sqlParam(len(args)+1) + ` offset ` + sqlParam(len(args)+2)
			args = append(args, limit+1, offset)

			rows, err := pool.Query(context.Background(), query, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list questions"})
				return
			}
			defer rows.Close()

			items := make([]PublicQuestionListItem, 0, limit)
			for rows.Next() {
				var id string
				var pkg *string
				var top *string
				var diff string
				var prompt string
				if err := rows.Scan(&id, &pkg, &top, &diff, &prompt); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list questions"})
					return
				}
				items = append(items, PublicQuestionListItem{ID: id, QuestionBankID: pkg, TopicID: top, DifficultyID: diff, Prompt: prompt})
				if len(items) == limit+1 {
					break
				}
			}

			hasMore := false
			if len(items) > limit {
				hasMore = true
				items = items[:limit]
			}
			c.JSON(http.StatusOK, ListQuestionsResponse{Items: items, Limit: limit, Offset: offset, HasMore: hasMore})
		})

		r.GET("/instructor/questions/:questionId", requireInstructorOrAdmin, func(c *gin.Context) {
			qid := c.Param("questionId")
			ctx := context.Background()

			var id string
			var pkg *string
			var top *string
			var diff string
			var prompt string
			var explanation string
			var status string
			var createdBy string
			var updatedBy string
			var createdAt time.Time
			var updatedAt time.Time
			err := pool.QueryRow(ctx, `select id, package_id, topic_id, difficulty_id, prompt, explanation_text, status, created_by_user_id, updated_by_user_id, created_at, updated_at
				from question_bank_questions where id=$1`, qid).
				Scan(&id, &pkg, &top, &diff, &prompt, &explanation, &status, &createdBy, &updatedBy, &createdAt, &updatedAt)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
				return
			}

			var correctChoiceID string
			_ = pool.QueryRow(ctx, `select choice_id from question_bank_correct_choice where question_id=$1`, id).Scan(&correctChoiceID)

			rows, err := pool.Query(ctx, `select id, text from question_bank_choices where question_id=$1 order by order_index asc`, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load choices"})
				return
			}
			defer rows.Close()

			choices := make([]PracticeQuestionChoice, 0)
			for rows.Next() {
				var cid string
				var text string
				if err := rows.Scan(&cid, &text); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to load choices"})
					return
				}
				choices = append(choices, PracticeQuestionChoice{ID: cid, Text: text})
			}

			c.JSON(http.StatusOK, InstructorQuestionResponse{
				ID:              id,
				QuestionBankID:       pkg,
				TopicID:         top,
				DifficultyID:    diff,
				Prompt:          prompt,
				Explanation:     explanation,
				Status:          QuestionStatus(status),
				CorrectChoiceID: correctChoiceID,
				Choices:         choices,
				CreatedByUserID: createdBy,
				UpdatedByUserID: updatedBy,
				CreatedAt:       createdAt.UTC().Format(time.RFC3339),
				UpdatedAt:       updatedAt.UTC().Format(time.RFC3339),
			})
		})

		r.PUT("/instructor/questions/:questionId", requireInstructorOrAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}
			role, _ := auth.GetRole(c)

			qid := c.Param("questionId")
			var req UpdateQuestionRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			set := []string{"updated_at=now()", "updated_by_user_id=$2"}
			args := []any{qid, userID}
			idx := 3
			if req.QuestionBankID != nil {
				set = append(set, "package_id="+sqlParam(idx))
				args = append(args, req.QuestionBankID)
				idx++
			}
			if req.TopicID != nil {
				set = append(set, "topic_id="+sqlParam(idx))
				args = append(args, req.TopicID)
				idx++
			}
			if req.DifficultyID != nil {
				set = append(set, "difficulty_id="+sqlParam(idx))
				args = append(args, *req.DifficultyID)
				idx++
			}
			if req.Prompt != nil {
				set = append(set, "prompt="+sqlParam(idx))
				args = append(args, strings.TrimSpace(*req.Prompt))
				idx++
			}
			if req.Explanation != nil {
				set = append(set, "explanation_text="+sqlParam(idx))
				args = append(args, strings.TrimSpace(*req.Explanation))
				idx++
			}

			if len(set) == 2 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "no updates"})
				return
			}

			ctx := context.Background()
			query := "update question_bank_questions set " + strings.Join(set, ", ") + " where id=$1"
			if role != "admin" {
				query += " and created_by_user_id=$2"
			}
			cmd, err := pool.Exec(ctx, query, args...)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update question"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.PUT("/instructor/questions/:questionId/choices", requireInstructorOrAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}
			role, _ := auth.GetRole(c)

			qid := c.Param("questionId")
			var req ReplaceChoicesRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}
			if len(req.Choices) < 2 {
				c.JSON(http.StatusBadRequest, gin.H{"message": "at least 2 choices are required"})
				return
			}
			if req.CorrectChoiceIndex < 0 || req.CorrectChoiceIndex >= len(req.Choices) {
				c.JSON(http.StatusBadRequest, gin.H{"message": "correctChoiceIndex out of range"})
				return
			}

			ctx := context.Background()
			tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update choices"})
				return
			}
			defer func() { _ = tx.Rollback(ctx) }()

			// Ensure question exists
			var exists bool
			if role == "admin" {
				if err := tx.QueryRow(ctx, `select exists(select 1 from question_bank_questions where id=$1)`, qid).Scan(&exists); err != nil || !exists {
					c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
					return
				}
			} else {
				if err := tx.QueryRow(ctx, `select exists(select 1 from question_bank_questions where id=$1 and created_by_user_id=$2)`, qid, userID).Scan(&exists); err != nil || !exists {
					c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
					return
				}
			}

			if !exists {
				c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
				return
			}

			_, err = tx.Exec(ctx, `delete from question_bank_choices where question_id=$1`, qid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update choices"})
				return
			}

			choiceIDs := make([]string, 0, len(req.Choices))
			for i, ch := range req.Choices {
				text := strings.TrimSpace(ch.Text)
				if text == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "choice text is required"})
					return
				}
				choiceID := util.NewID("ch")
				_, err = tx.Exec(ctx, `insert into question_bank_choices (id, question_id, order_index, text) values ($1,$2,$3,$4)`, choiceID, qid, i, text)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update choices"})
					return
				}
				choiceIDs = append(choiceIDs, choiceID)
			}

			correctChoiceID := choiceIDs[req.CorrectChoiceIndex]
			_, err = tx.Exec(ctx, `insert into question_bank_correct_choice (question_id, choice_id) values ($1,$2)
				on conflict (question_id) do update set choice_id=excluded.choice_id`, qid, correctChoiceID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to set correct choice"})
				return
			}

			_, _ = tx.Exec(ctx, `update question_bank_questions set updated_at=now(), updated_by_user_id=$2 where id=$1`, qid, userID)

			if err := tx.Commit(ctx); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update choices"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		deleteQuestion := func(scope string) gin.HandlerFunc {
			return func(c *gin.Context) {
				qid := strings.TrimSpace(c.Param("questionId"))
				if qid == "" {
					c.JSON(http.StatusBadRequest, gin.H{"message": "questionId is required"})
					return
				}

				userID, ok := auth.GetUserID(c)
				if !ok {
					c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
					return
				}

				role, _ := auth.GetRole(c)
				isAdmin := role == "admin" || scope == "admin"

				ctx := context.Background()
				tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to delete question"})
					return
				}
				defer func() { _ = tx.Rollback(ctx) }()

				// Delete dependent records first.
				_, _ = tx.Exec(ctx, `delete from question_bank_correct_choice where question_id=$1`, qid)
				_, _ = tx.Exec(ctx, `delete from question_bank_choices where question_id=$1`, qid)

				query := `delete from question_bank_questions where id=$1`
				args := []any{qid}
				if !isAdmin {
					query += ` and created_by_user_id=$2`
					args = append(args, userID)
				}
				cmd, err := tx.Exec(ctx, query, args...)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to delete question"})
					return
				}
				if cmd.RowsAffected() == 0 {
					c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
					return
				}

				if err := tx.Commit(ctx); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to delete question"})
					return
				}

				c.JSON(http.StatusOK, gin.H{"ok": true})
			}
		}

		setStatus := func(status QuestionStatus) gin.HandlerFunc {
			return func(c *gin.Context) {
				userID, ok := auth.GetUserID(c)
				if !ok {
					c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
					return
				}
				role, _ := auth.GetRole(c)
				if status == QuestionPublished && role != "admin" {
					c.JSON(http.StatusForbidden, gin.H{"message": "forbidden"})
					return
				}
				qid := c.Param("questionId")
				query := `update question_bank_questions set status=$1, updated_at=now(), updated_by_user_id=$2 where id=$3`
				args := []any{string(status), userID, qid}
				if role != "admin" {
					query += " and created_by_user_id=$2"
				}
				cmd, err := pool.Exec(context.Background(), query, args...)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to update status"})
					return
				}
				if cmd.RowsAffected() == 0 {
					c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
					return
				}
				c.JSON(http.StatusOK, gin.H{"ok": true})
			}
		}

		submitForReview := func() gin.HandlerFunc {
			return func(c *gin.Context) {
				userID, ok := auth.GetUserID(c)
				if !ok {
					c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
					return
				}
				role, _ := auth.GetRole(c)
				qid := c.Param("questionId")

				query := `update question_bank_questions set status=$1, review_note='', updated_at=now(), updated_by_user_id=$2 where id=$3`
				args := []any{string(QuestionInReview), userID, qid}
				if role != "admin" {
					query += " and created_by_user_id=$2"
				}
				cmd, err := pool.Exec(context.Background(), query, args...)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to submit for review"})
					return
				}
				if cmd.RowsAffected() == 0 {
					c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
					return
				}
				c.JSON(http.StatusOK, gin.H{"ok": true})
			}
		}

		requireAdmin := auth.RequirePortalAuth(pool, "admin", "admin")

		r.DELETE("/admin/questions/:questionId", requireAdmin, deleteQuestion("admin"))
		r.DELETE("/instructor/questions/:questionId", requireInstructorOrAdmin, deleteQuestion("instructor"))

		r.POST("/admin/questions/:questionId/approve", requireAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}
			qid := c.Param("questionId")
			cmd, err := pool.Exec(context.Background(), `update question_bank_questions set status=$1, review_note='', updated_at=now(), updated_by_user_id=$2 where id=$3`, string(QuestionPublished), userID, qid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to approve"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.POST("/admin/questions/:questionId/request-changes", requireAdmin, func(c *gin.Context) {
			userID, ok := auth.GetUserID(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
				return
			}
			qid := c.Param("questionId")
			var body struct {
				Note string `json:"note"`
			}
			_ = c.ShouldBindJSON(&body)
			note := strings.TrimSpace(body.Note)
			cmd, err := pool.Exec(context.Background(), `update question_bank_questions set status=$1, review_note=$2, updated_at=now(), updated_by_user_id=$3 where id=$4`, string(QuestionNeedsChanges), note, userID, qid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to request changes"})
				return
			}
			if cmd.RowsAffected() == 0 {
				c.JSON(http.StatusNotFound, gin.H{"message": "question not found"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		r.POST("/instructor/questions/:questionId/publish", requireInstructorOrAdmin, setStatus(QuestionPublished))
		r.POST("/instructor/questions/:questionId/archive", requireInstructorOrAdmin, setStatus(QuestionArchived))
		r.POST("/instructor/questions/:questionId/draft", requireInstructorOrAdmin, setStatus(QuestionDraft))
		r.POST("/instructor/questions/:questionId/submit-for-review", requireInstructorOrAdmin, submitForReview())
	}
}
