package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type ContextKey string

const UserIDKey ContextKey = "userId"

func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authz := c.GetHeader("Authorization")
		if authz == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "missing authorization"})
			return
		}

		parts := strings.SplitN(authz, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid authorization"})
			return
		}

		claims, err := ParseAccessToken(parts[1])
		if err != nil || claims.Subject == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid token"})
			return
		}

		c.Set(string(UserIDKey), claims.Subject)
		c.Next()
	}
}

func GetUserID(c *gin.Context) (string, bool) {
	v, ok := c.Get(string(UserIDKey))
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok && s != ""
}
