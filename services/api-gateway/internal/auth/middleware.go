package auth

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContextKey string

const UserIDKey ContextKey = "userId"
const RoleKey ContextKey = "role"
const SessionIDKey ContextKey = "sessionId"

const (
	HeaderAuthorization = "Authorization"
	CookieAccessName    = "ace_access"
)

// extractBearerOrCookie extracts token from Authorization header or cookie.
func extractBearerOrCookie(c *gin.Context) string {
	authz := c.GetHeader(HeaderAuthorization)
	if authz != "" {
		parts := strings.SplitN(authz, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1])
		}
		return ""
	}
	if v, err := c.Cookie(CookieAccessName); err == nil {
		return strings.TrimSpace(v)
	}
	return ""
}

func intFromEnv(name string, fallback int) int {
	if v := os.Getenv(name); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

// allowStrictSessionCheck controls whether DB session checks are required.
func allowStrictSessionCheck() bool {
	v := os.Getenv("AUTH_STRICT_SESSION_CHECK")
	if v == "" {
		return true
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return true
	}
	return b
}

func RequirePortalAuth(pool *pgxpool.Pool, expectedRole string, expectedAudience string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractBearerOrCookie(c)
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "missing authorization"})
			return
		}

		claims, err := ParseAccessToken(token)
		if err != nil || claims.Subject == "" {
			// ParseAccessToken returns typed errors; map them to 401/403 as appropriate.
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
			timeoutMs := intFromEnv("AUTH_DB_TIMEOUT_MS", 2000)
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutMs)*time.Millisecond)
			defer cancel()

			var revokedAt *time.Time
			var expiresAt time.Time
			err := pool.QueryRow(ctx, `select revoked_at, expires_at from auth_sessions where id=$1 and user_id=$2`, claims.SessionID, claims.Subject).
				Scan(&revokedAt, &expiresAt)
			if err != nil {
				if allowStrictSessionCheck() {
					log.Printf("DEBUG: auth: session DB check failed: %v", err)
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
					return
				}
				// graceful degradation: log and continue with JWT-only validation
				log.Printf("WARN: auth: session DB unavailable, falling back to JWT-only validation: %v", err)
			} else {
				now := time.Now().UTC()
				if revokedAt != nil || !expiresAt.After(now) {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
					return
				}
				// best-effort update of last_seen_at
				if _, err := pool.Exec(ctx, `update auth_sessions set last_seen_at=now() where id=$1`, claims.SessionID); err != nil {
					log.Printf("DEBUG: auth: failed to update last_seen_at: %v", err)
				}
			}
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
