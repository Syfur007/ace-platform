package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
)

type ExamPackageListItem struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
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

func RegisterEnrollmentRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	// Public-ish reference data (used by multiple portals)
	r.GET("/exam-packages", func(c *gin.Context) {
		rows, err := pool.Query(context.Background(), `select id, name, created_at from exam_packages where is_hidden=false order by name asc`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list exam packages"})
			return
		}
		defer rows.Close()

		items := []ExamPackageListItem{}
		for rows.Next() {
			var id, name string
			var createdAt time.Time
			if err := rows.Scan(&id, &name, &createdAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list exam packages"})
				return
			}
			items = append(items, ExamPackageListItem{ID: id, Name: name, CreatedAt: createdAt.UTC().Format(time.RFC3339)})
		}
		c.JSON(http.StatusOK, ListExamPackagesResponse{Items: items})
	})

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
}
