package exampackage

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	dom "github.com/ace-platform/apps/backend/internal/domain/exampackage"
	"github.com/gin-gonic/gin"
)

// DTOs mirror previous response shapes so we don't break API contracts.
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

func RegisterPublicRoutes(r *gin.Engine, svc *dom.ExamPackageService) {
	// GET /exam-packages
	r.GET("/exam-packages", func(c *gin.Context) {
		pkgs, err := svc.ListPackages(context.Background(), false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list exam packages"})
			return
		}
		items := make([]ExamPackageListItem, 0, len(pkgs))
		for _, p := range pkgs {
			ms := make([]ExamPackageModuleSection, 0, len(p.ModuleSections))
			for _, s := range p.ModuleSections {
				ms = append(ms, ExamPackageModuleSection{ID: s.ID, Name: s.Name, Description: s.Description})
			}
			items = append(items, ExamPackageListItem{ID: p.ID, Name: p.Name, Subtitle: p.Subtitle, Overview: p.Overview, Modules: p.Modules, Highlights: p.Highlights, ModuleSections: ms, CreatedAt: p.CreatedAt.UTC().Format(time.RFC3339)})
		}
		c.JSON(http.StatusOK, ListExamPackagesResponse{Items: items})
	})

	// GET /exam-packages/:examPackageId/tiers
	r.GET("/exam-packages/:examPackageId/tiers", func(c *gin.Context) {
		examPackageID := strings.TrimSpace(c.Param("examPackageId"))
		if examPackageID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "examPackageId is required"})
			return
		}
		tiers, err := svc.ListTiers(context.Background(), examPackageID, true)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list tiers"})
			return
		}
		items := make([]ExamPackageTierListItem, 0, len(tiers))
		for _, t := range tiers {
			items = append(items, ExamPackageTierListItem{ID: t.ID, ExamPackageID: t.ExamPackageID, Code: t.Code, Name: t.Name, SortOrder: t.SortOrder, IsDefault: t.IsDefault})
		}
		c.JSON(http.StatusOK, ListExamPackageTiersResponse{Items: items})
	})
}
