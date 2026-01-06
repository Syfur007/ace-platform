package exampackage

import (
	"context"
	"net/http"
	"strings"
	"time"

	dom "github.com/ace-platform/apps/backend/internal/domain/exampackage"
	"github.com/ace-platform/apps/backend/internal/auth"
	"github.com/gin-gonic/gin"
)

type EnrollmentItem struct {
	ExamPackageID string `json:"examPackageId"`
	TierID        string `json:"tierId"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

type EnrollmentListResponse struct {
	ExamPackageIDs []string        `json:"examPackageIds,omitempty"`
	Items          []EnrollmentItem `json:"items"`
}

type EnrollRequest struct {
	ExamPackageID string  `json:"examPackageId"`
	TierID        *string `json:"tierId"`
}

type ChangeTierRequest struct {
	TierID string `json:"tierId"`
}

func RegisterStudentRoutes(r *gin.Engine, svc *dom.ExamPackageService, pool interface{}) {
	// student routes require portal auth
	r.GET("/student/enrollments", auth.RequirePortalAuth(nil, "student", "student"), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}
		ctx := context.Background()
		// reuse repository via service if we had a list method; for now call repo through service by listing enrollments?
		// As a minimal first step, re-use existing SQL not yet moved. TODO: implement service.ListEnrollments
		_ = ctx
		// Return empty result until service.ListEnrollments implemented
		c.JSON(http.StatusOK, EnrollmentListResponse{ExamPackageIDs: []string{}, Items: []EnrollmentItem{}})
	})

	r.POST("/student/enrollments", auth.RequirePortalAuth(nil, "student", "student"), func(c *gin.Context) {
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
		var desiredTier *string
		if req.TierID != nil && strings.TrimSpace(*req.TierID) != "" {
			t := strings.TrimSpace(*req.TierID)
			desiredTier = &t
		}
		if err := svc.EnrollUser(context.Background(), userID, pkg, desiredTier); err != nil {
			if err == dom.ErrPackageNotFound {
				c.JSON(http.StatusBadRequest, gin.H{"message": "unknown package"})
				return
			}
			if err == dom.ErrInvalidTier {
				c.JSON(http.StatusBadRequest, gin.H{"message": "unknown tier"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to enroll"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	r.POST("/student/enrollments/:examPackageId/change-tier", auth.RequirePortalAuth(nil, "student", "student"), func(c *gin.Context) {
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
		if err := svc.ChangeTier(context.Background(), userID, examPackageID, newTierID); err != nil {
			if err == dom.ErrNotEnrolled {
				c.JSON(http.StatusForbidden, gin.H{"message": "not enrolled"})
				return
			}
			if err == dom.ErrInvalidTier {
				c.JSON(http.StatusBadRequest, gin.H{"message": "unknown tier"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to change tier"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	r.DELETE("/student/enrollments/:examPackageId", auth.RequirePortalAuth(nil, "student", "student"), func(c *gin.Context) {
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
		if err := svc.DeleteEnrollment(context.Background(), userID, examPackageID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to cancel enrollment"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})
}
