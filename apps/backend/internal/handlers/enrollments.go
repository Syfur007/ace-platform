package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/apps/backend/internal/auth"
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
	// Back-compat for older clients.
	ExamPackageIDs []string `json:"examPackageIds,omitempty"`
	Items          []EnrollmentItem `json:"items"`
}

type EnrollRequest struct {
	ExamPackageID string `json:"examPackageId"`
	TierID        *string `json:"tierId"`
}

type ChangeTierRequest struct {
	TierID string `json:"tierId"`
}

type EnrollmentItem struct {
	ExamPackageID string `json:"examPackageId"`
	TierID        string `json:"tierId"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

type ExamPackageTierListItem struct {
	ID            string `json:"id"`
	ExamPackageID string `json:"examPackageId"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	SortOrder     int    `json:"sortOrder"`
	IsDefault     bool   `json:"isDefault"`
}

type ListExamPackageTiersResponse struct {
	Items []ExamPackageTierListItem `json:"items"`
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

	// Public-ish: list active tiers for a package (display-only; no policy details).
	r.GET("/exam-packages/:examPackageId/tiers", func(c *gin.Context) {
		examPackageID := strings.TrimSpace(c.Param("examPackageId"))
		if examPackageID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
			return
		}

		rows, err := pool.Query(context.Background(), `
			select id::text, exam_package_id::text, code, name, sort_order, is_default
			from exam_package_tiers
			where exam_package_id=$1 and is_active=true
			order by sort_order asc, created_at asc`, examPackageID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list tiers"})
			return
		}
		defer rows.Close()

		items := []ExamPackageTierListItem{}
		for rows.Next() {
			var id string
			var pkgID string
			var code string
			var name string
			var sortOrder int
			var isDefault bool
			if err := rows.Scan(&id, &pkgID, &code, &name, &sortOrder, &isDefault); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list tiers"})
				return
			}
			items = append(items, ExamPackageTierListItem{
				ID:            id,
				ExamPackageID: pkgID,
				Code:          code,
				Name:          name,
				SortOrder:     sortOrder,
				IsDefault:     isDefault,
			})
		}

		c.JSON(http.StatusOK, ListExamPackageTiersResponse{Items: items})
	})

	// Instructor/admin: update exam package metadata.
	{
		requireInstructorOrAdmin := authRequireRolesAndAudiences(pool, []string{"instructor", "admin"}, []string{"instructor", "admin"})

		r.GET("/instructor/exam-packages", requireInstructorOrAdmin, func(c *gin.Context) {
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
					ID:             id,
					Code:           code,
					Name:           name,
					Subtitle:       subtitle,
					Overview:       overview,
					Modules:        modules,
					Highlights:     highlights,
					ModuleSections: moduleSections,
					IsHidden:       hidden,
					CreatedAt:      createdAt.UTC().Format(time.RFC3339),
					UpdatedAt:      updatedAt.UTC().Format(time.RFC3339),
				})
			}

			c.JSON(http.StatusOK, ListAdminExamPackagesResponse{Items: items})
		})

		// Instructor/admin: manage tiers for an exam package.
		r.GET("/instructor/exam-packages/:examPackageId/tiers", requireInstructorOrAdmin, func(c *gin.Context) {
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

		r.POST("/instructor/exam-packages/:examPackageId/tiers", requireInstructorOrAdmin, func(c *gin.Context) {
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
			audit(ctx, pool, actorUserID, actorRole, "instructor.exam_package_tiers.create", "exam_package_tier", newID, gin.H{"examPackageId": examPackageID, "code": code, "name": name})
			c.JSON(http.StatusOK, CreateAdminExamPackageTierResponse{ID: newID})
		})

		r.PATCH("/instructor/exam-packages/:examPackageId/tiers/:tierId", requireInstructorOrAdmin, func(c *gin.Context) {
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

			var currentIsDefault bool
			if err := tx.QueryRow(ctx, `select is_default from exam_package_tiers where id=$1 and exam_package_id=$2`, tierID, examPackageID).Scan(&currentIsDefault); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": "tier not found"})
				return
			}

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
			audit(ctx, pool, actorUserID, actorRole, "instructor.exam_package_tiers.update", "exam_package_tier", tierID, req)
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

		r.DELETE("/instructor/exam-packages/:examPackageId/tiers/:tierId", requireInstructorOrAdmin, func(c *gin.Context) {
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
			audit(ctx, pool, actorUserID, actorRole, "instructor.exam_package_tiers.delete", "exam_package_tier", tierID, gin.H{"examPackageId": examPackageID})
			c.JSON(http.StatusOK, gin.H{"success": true})
		})

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

		rows, err := pool.Query(context.Background(), `
			select exam_package_id::text, coalesce(tier_id::text, ''), created_at, updated_at
			from user_exam_package_enrollments
			where user_id=$1
			order by created_at asc`, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list enrollments"})
			return
		}
		defer rows.Close()

		ids := []string{}
		items := []EnrollmentItem{}
		for rows.Next() {
			var pkgID string
			var tierID string
			var createdAt time.Time
			var updatedAt time.Time
			if err := rows.Scan(&pkgID, &tierID, &createdAt, &updatedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list enrollments"})
				return
			}
			ids = append(ids, pkgID)
			items = append(items, EnrollmentItem{
				ExamPackageID: pkgID,
				TierID:        tierID,
				CreatedAt:     createdAt.UTC().Format(time.RFC3339),
				UpdatedAt:     updatedAt.UTC().Format(time.RFC3339),
			})
		}

		c.JSON(http.StatusOK, EnrollmentListResponse{ExamPackageIDs: ids, Items: items})
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

		ctx := context.Background()

		// Resolve desired tier.
		var tierID string
		if req.TierID != nil && strings.TrimSpace(*req.TierID) != "" {
			tierID = strings.TrimSpace(*req.TierID)
			var tierOk bool
			if err := pool.QueryRow(ctx, `select exists(select 1 from exam_package_tiers where id=$1 and exam_package_id=$2 and is_active=true)`, tierID, pkg).Scan(&tierOk); err != nil || !tierOk {
				c.JSON(http.StatusBadRequest, gin.H{"message": "unknown tier"})
				return
			}
		} else {
			if err := pool.QueryRow(ctx, `
				select id::text
				from exam_package_tiers
				where exam_package_id=$1 and is_active=true
				order by is_default desc, sort_order asc, created_at asc
				limit 1`, pkg).Scan(&tierID); err != nil || tierID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "package has no active tier"})
				return
			}
		}

		ct, err := pool.Exec(ctx, `
			insert into user_exam_package_enrollments (user_id, exam_package_id, tier_id)
			values ($1,$2,$3)
			on conflict (user_id, exam_package_id) do update set
				tier_id = coalesce(user_exam_package_enrollments.tier_id, excluded.tier_id),
				updated_at = case when user_exam_package_enrollments.tier_id is null then now() else user_exam_package_enrollments.updated_at end`,
			userID, pkg, tierID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to enroll"})
			return
		}
		if ct.RowsAffected() > 0 {
			_, _ = pool.Exec(ctx, `
				insert into user_exam_package_enrollment_events (user_id, exam_package_id, from_tier_id, to_tier_id, changed_by_user_id, reason)
				values ($1,$2,null,$3::uuid,$1,'enroll')`, userID, pkg, tierID)
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Student: change tier within an existing enrollment.
	r.POST("/student/enrollments/:examPackageId/change-tier", auth.RequirePortalAuth(pool, "student", "student"), func(c *gin.Context) {
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

		var req ChangeTierRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}
		newTierID := strings.TrimSpace(req.TierID)
		if newTierID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "tierId is required"})
			return
		}

		ctx := context.Background()

		var currentTierID string
		if err := pool.QueryRow(ctx, `select coalesce(tier_id::text, '') from user_exam_package_enrollments where user_id=$1 and exam_package_id=$2`, userID, examPackageID).Scan(&currentTierID); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"message": "not enrolled"})
			return
		}

		var tierOk bool
		if err := pool.QueryRow(ctx, `select exists(select 1 from exam_package_tiers where id=$1 and exam_package_id=$2 and is_active=true)`, newTierID, examPackageID).Scan(&tierOk); err != nil || !tierOk {
			c.JSON(http.StatusBadRequest, gin.H{"message": "unknown tier"})
			return
		}

		if currentTierID == newTierID {
			c.JSON(http.StatusOK, gin.H{"success": true})
			return
		}

		_, err := pool.Exec(ctx, `update user_exam_package_enrollments set tier_id=$3::uuid, updated_at=now() where user_id=$1 and exam_package_id=$2`, userID, examPackageID, newTierID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to change tier"})
			return
		}

		_, _ = pool.Exec(ctx, `
			insert into user_exam_package_enrollment_events (user_id, exam_package_id, from_tier_id, to_tier_id, changed_by_user_id, reason)
			values ($1,$2,nullif($3,'')::uuid,$4::uuid,$1,'change_tier')`, userID, examPackageID, currentTierID, newTierID)

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
