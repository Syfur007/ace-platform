package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type ContextKey string

const UserIDKey ContextKey = "userId"
const RoleKey ContextKey = "role"

func RequirePortalAuth(expectedRole string, expectedAudience string) gin.HandlerFunc {
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

		if expectedRole != "" && claims.Role != expectedRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "forbidden"})
			return
		}

		if expectedAudience != "" {
			ok := false
			for _, aud := range claims.Audience {
				if aud == expectedAudience {
					ok = true
					break
				}
			}
			if !ok {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "forbidden"})
				return
			}
		}

		c.Set(string(UserIDKey), claims.Subject)
		c.Set(string(RoleKey), claims.Role)
		c.Next()
	}
}

func RequireAuth() gin.HandlerFunc {
	return RequirePortalAuth("", "")
}

func GetUserID(c *gin.Context) (string, bool) {
	v, ok := c.Get(string(UserIDKey))
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok && s != ""
}

func GetRole(c *gin.Context) (string, bool) {
	v, ok := c.Get(string(RoleKey))
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok && s != ""
}
