package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

func parseListParams(c *gin.Context) (limit int, offset int) {
	limit = 20
	offset = 0
	if raw := c.Query("limit"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil {
			limit = v
		}
	}
	if raw := c.Query("offset"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil {
			offset = v
		}
	}
	if limit < 1 {
		limit = 1
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	return
}
