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

type ExamPackageModuleSection struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type ExamPackageListItem struct {
	ID             string                    `json:"id"`
	Name           string                    `json:"name"`
	Subtitle       *string                   `json:"subtitle"`
	Overview       *string                   `json:"overview"`
	Modules        []string                  `json:"modules"`
	Highlights     []string                  `json:"highlights"`
	ModuleSections []ExamPackageModuleSection `json:"moduleSections"`
	CreatedAt      string                    `json:"createdAt"`
}

type ListExamPackagesResponse struct {
	Items []ExamPackageListItem `json:"items"`
}

type EnrollmentListResponse struct {
	ExamPackageIDs []string `json:"examPackageIds"`
}

type EnrollRequest struct {
	ExamPackageID string `json:"examPackageId"`
}

type UpdateInstructorExamPackageRequest struct {
	Subtitle       *string                    `json:"subtitle"`
	Overview       *string                    `json:"overview"`
	Modules        *[]string                  `json:"modules"`
	Highlights     *[]string                  `json:"highlights"`
	ModuleSections *[]ExamPackageModuleSection `json:"moduleSections"`
}

func RegisterEnrollmentRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	// Public-ish reference data (used by multiple portals)
	r.GET("/exam-packages", func(c *gin.Context) {
		rows, err := pool.Query(context.Background(), `
			select
				id::text,
				name,
				subtitle,
				overview,
				modules,
				highlights,
				module_sections,
				created_at
			from exam_packages
			where is_hidden=false
			order by name asc`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list exam packages"})
			return
		}
		defer rows.Close()

		items := []ExamPackageListItem{}
		for rows.Next() {
			var id, name string
			var subtitle *string
			var overview *string
			var modulesRaw []byte
			var highlightsRaw []byte
			var moduleSectionsRaw []byte
			var createdAt time.Time
			if err := rows.Scan(&id, &name, &subtitle, &overview, &modulesRaw, &highlightsRaw, &moduleSectionsRaw, &createdAt); err != nil {
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

			items = append(items, ExamPackageListItem{
				ID:             id,
				Name:           name,
				Subtitle:       subtitle,
				Overview:       overview,
				Modules:        modules,
				Highlights:     highlights,
				ModuleSections: moduleSections,
				CreatedAt:      createdAt.UTC().Format(time.RFC3339),
			})
		}
		c.JSON(http.StatusOK, ListExamPackagesResponse{Items: items})
	})

	// Instructor/admin: update exam package metadata.
	{
		requireInstructorOrAdmin := authRequireRolesAndAudiences(pool, []string{"instructor", "admin"}, []string{"instructor", "admin"})

		r.PATCH("/instructor/exam-packages/:examPackageId", requireInstructorOrAdmin, func(c *gin.Context) {
			actorUserID, _ := auth.GetUserID(c)
			actorRole, _ := auth.GetRole(c)

			examPackageID := strings.TrimSpace(c.Param("examPackageId"))
			if examPackageID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
				return
			}

			var req UpdateInstructorExamPackageRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
				return
			}

			set := []string{"updated_at=now()"}
			args := []any{}
			idx := 1
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
			audit(context.Background(), pool, actorUserID, actorRole, "instructor.exam_packages.update", "exam_package", examPackageID, req)
			c.JSON(http.StatusOK, gin.H{"success": true})
		})
	}

	// Student enrollments
	r.GET("/student/enrollments", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		rows, err := pool.Query(context.Background(), `select exam_package_id from user_exam_package_enrollments where user_id=$1 order by created_at asc`, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list enrollments"})
			return
		}
		defer rows.Close()

		ids := []string{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list enrollments"})
				return
			}
			ids = append(ids, id)
		}

		c.JSON(http.StatusOK, EnrollmentListResponse{ExamPackageIDs: ids})
	})

	r.POST("/student/enrollments", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		var req EnrollRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}

		pkg := strings.TrimSpace(req.ExamPackageID)
		if pkg == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
			return
		}

		// ensure package exists + not hidden
		var exists bool
		if err := pool.QueryRow(context.Background(), `select exists(select 1 from exam_packages where id=$1 and is_hidden=false)`, pkg).Scan(&exists); err != nil || !exists {
			c.JSON(http.StatusBadRequest, gin.H{"message": "unknown package"})
			return
		}

		_, err := pool.Exec(context.Background(), `insert into user_exam_package_enrollments (user_id, exam_package_id) values ($1,$2) on conflict do nothing`, userID, pkg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to enroll"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	r.DELETE("/student/enrollments/:examPackageId", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		examPackageID := strings.TrimSpace(c.Param("examPackageId"))
		if examPackageID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
			return
		}

		_, err := pool.Exec(context.Background(), `delete from user_exam_package_enrollments where user_id=$1 and exam_package_id=$2`, userID, examPackageID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to cancel enrollment"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	})
}
