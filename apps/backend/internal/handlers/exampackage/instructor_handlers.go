package exampackage

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	dom "github.com/ace-platform/apps/backend/internal/domain/exampackage"
	"github.com/ace-platform/apps/backend/internal/auth"
	"github.com/gin-gonic/gin"
)

// Admin DTOs (preserve API shapes)
type AdminExamPackageListItem struct {
	ID             string                    `json:"id"`
	Code           string                    `json:"code"`
	Name           string                    `json:"name"`
	Subtitle       *string                   `json:"subtitle"`
	Overview       *string                   `json:"overview"`
	Modules        []string                  `json:"modules"`
	Highlights     []string                  `json:"highlights"`
	ModuleSections []ExamPackageModuleSection `json:"moduleSections"`
	IsHidden       bool                      `json:"isHidden"`
	CreatedAt      string                    `json:"createdAt"`
	UpdatedAt      string                    `json:"updatedAt"`
}

type ListAdminExamPackagesResponse struct {
	Items []AdminExamPackageListItem `json:"items"`
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

// create/update requests
type CreateAdminExamPackageTierRequest struct {
	Code      string           `json:"code"`
	Name      string           `json:"name"`
	SortOrder *int             `json:"sortOrder"`
	IsDefault *bool            `json:"isDefault"`
	IsActive  *bool            `json:"isActive"`
	Policy    *json.RawMessage `json:"policy"`
}

type UpdateAdminExamPackageTierRequest struct {
	Code      *string          `json:"code"`
	Name      *string          `json:"name"`
	SortOrder *int             `json:"sortOrder"`
	IsDefault *bool            `json:"isDefault"`
	IsActive  *bool            `json:"isActive"`
	Policy    *json.RawMessage `json:"policy"`
}

type CreateAdminExamPackageTierResponse struct {
	ID string `json:"id"`
}

func RegisterInstructorRoutes(r *gin.Engine, svc *dom.ExamPackageService, pool interface{}) {
	requireInstructorOrAdmin := authRequireRolesAndAudiences(nil, []string{"instructor", "admin"}, []string{"instructor", "admin"})

	r.GET("/instructor/exam-packages", requireInstructorOrAdmin, func(c *gin.Context) {
		pkgs, err := svc.ListPackages(context.Background(), true)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list exam packages"})
			return
		}
		items := []AdminExamPackageListItem{}
		for _, p := range pkgs {
			ms := make([]ExamPackageModuleSection, 0, len(p.ModuleSections))
			for _, s := range p.ModuleSections {
				ms = append(ms, ExamPackageModuleSection{ID: s.ID, Name: s.Name, Description: s.Description})
			}
			items = append(items, AdminExamPackageListItem{ID: p.ID, Code: p.Code, Name: p.Name, Subtitle: p.Subtitle, Overview: p.Overview, Modules: p.Modules, Highlights: p.Highlights, ModuleSections: ms, IsHidden: p.IsHidden, CreatedAt: p.CreatedAt.UTC().Format(time.RFC3339), UpdatedAt: p.UpdatedAt.UTC().Format(time.RFC3339)})
		}
		c.JSON(http.StatusOK, ListAdminExamPackagesResponse{Items: items})
	})

	r.GET("/instructor/exam-packages/:examPackageId/tiers", requireInstructorOrAdmin, func(c *gin.Context) {
		examPackageID := strings.TrimSpace(c.Param("examPackageId"))
		if examPackageID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
			return
		}
		tiers, err := svc.ListTiers(context.Background(), examPackageID, false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list tiers"})
			return
		}
		items := []AdminExamPackageTier{}
		for _, t := range tiers {
			items = append(items, AdminExamPackageTier{ID: t.ID, ExamPackageID: t.ExamPackageID, Code: t.Code, Name: t.Name, SortOrder: t.SortOrder, IsDefault: t.IsDefault, IsActive: t.IsActive, Policy: t.Policy, CreatedAt: t.CreatedAt.UTC().Format(time.RFC3339), UpdatedAt: t.UpdatedAt.UTC().Format(time.RFC3339)})
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
		sortOrder := 0
		if req.SortOrder != nil {
			sortOrder = *req.SortOrder
		}
		isDefault := false
		if req.IsDefault != nil && *req.IsDefault {
			isDefault = true
		}

		t := &dom.ExamPackageTier{ExamPackageID: examPackageID, Code: code, Name: name, SortOrder: sortOrder, IsDefault: isDefault, IsActive: isActive, Policy: policy}
		id, err := svc.CreateTier(context.Background(), actorUserID, actorRole, t)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "failed to create tier"})
			return
		}
		c.JSON(http.StatusOK, CreateAdminExamPackageTierResponse{ID: id})
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
		// Fetch existing tier then apply updates
		t, err := svc.GetTierByID(context.Background(), tierID, examPackageID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "tier not found"})
			return
		}
		if req.Code != nil {
			v := strings.TrimSpace(*req.Code)
			if v == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "code cannot be empty"})
				return
			}
			t.Code = v
		}
		if req.Name != nil {
			v := strings.TrimSpace(*req.Name)
			if v == "" {
				c.JSON(http.StatusBadRequest, gin.H{"message": "name cannot be empty"})
				return
			}
			t.Name = v
		}
		if req.SortOrder != nil {
			t.SortOrder = *req.SortOrder
		}
		if req.IsActive != nil {
			if !*req.IsActive && t.IsDefault {
				c.JSON(http.StatusBadRequest, gin.H{"message": "cannot deactivate the default tier; set another default tier first"})
				return
			}
			t.IsActive = *req.IsActive
		}
		if req.IsDefault != nil {
			if !*req.IsDefault && t.IsDefault {
				c.JSON(http.StatusBadRequest, gin.H{"message": "cannot unset default tier; set another default tier first"})
				return
			}
			t.IsDefault = *req.IsDefault
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
			t.Policy = v
		}
		if err := svc.UpdateTier(context.Background(), actorUserID, actorRole, t); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "failed to update tier"})
			return
		}
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
		if err := svc.DeleteTier(context.Background(), actorUserID, actorRole, tierID, examPackageID); err != nil {
			if err == dom.ErrTierNotFound {
				c.JSON(http.StatusNotFound, gin.H{"message": "tier not found"})
				return
			}
			c.JSON(http.StatusConflict, gin.H{"message": "failed to delete tier"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Note: package update endpoints (PATCH /instructor/exam-packages/:examPackageId) still use the original logic.
}
