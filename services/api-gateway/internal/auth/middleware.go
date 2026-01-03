package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContextKey string

const UserIDKey ContextKey = "userId"
const RoleKey ContextKey = "role"
const SessionIDKey ContextKey = "sessionId"

func RequirePortalAuth(pool *pgxpool.Pool, expectedRole string, expectedAudience string) gin.HandlerFunc {
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

		claims, err := ParseAccessToken(token)
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

		// If token is tied to a DB session, enforce revocation + expiry server-side.
		if claims.SessionID != "" && pool != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			var revokedAt *time.Time
			var expiresAt time.Time
			err := pool.QueryRow(ctx, `select revoked_at, expires_at from auth_sessions where id=$1 and user_id=$2`, claims.SessionID, claims.Subject).
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
			_, _ = pool.Exec(ctx, `update auth_sessions set last_seen_at=now() where id=$1`, claims.SessionID)
		}

		c.Set(string(UserIDKey), claims.Subject)
		c.Set(string(RoleKey), claims.Role)
		c.Set(string(SessionIDKey), claims.SessionID)
		c.Next()
	}
}

func RequireAuth(pool *pgxpool.Pool) gin.HandlerFunc {
	return RequirePortalAuth(pool, "", "")
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

func GetSessionID(c *gin.Context) (string, bool) {
	v, ok := c.Get(string(SessionIDKey))
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok && s != ""
}
