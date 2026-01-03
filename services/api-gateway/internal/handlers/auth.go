package handlers

import (
	"context"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ace-platform/api-gateway/internal/auth"
	"github.com/ace-platform/api-gateway/internal/util"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
}

type AuthResponse struct {
	AccessToken string       `json:"accessToken"`
	User        UserResponse `json:"user"`
}

const (
	roleStudent    = "student"
	roleInstructor = "instructor"
	roleAdmin      = "admin"
)

const (
	accessCookieName  = "ace_access"
	refreshCookieName = "ace_refresh"
	csrfCookieName    = "ace_csrf"
)

func cookieSecure() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("COOKIE_SECURE")))
	return v == "1" || v == "true" || v == "yes"
}

func setAuthCookies(c *gin.Context, accessToken string, refreshToken string, csrfToken string, accessTTL time.Duration, refreshTTL time.Duration) {
	secure := cookieSecure()
	c.SetSameSite(http.SameSiteLaxMode)

	// Access token cookie
	c.SetCookie(accessCookieName, accessToken, int(accessTTL.Seconds()), "/", "", secure, true)
	// Refresh token cookie
	c.SetCookie(refreshCookieName, refreshToken, int(refreshTTL.Seconds()), "/", "", secure, true)
	// CSRF cookie (double-submit token; must be readable by JS)
	c.SetCookie(csrfCookieName, csrfToken, int(refreshTTL.Seconds()), "/", "", secure, false)
}

func clearAuthCookies(c *gin.Context) {
	secure := cookieSecure()
	// MaxAge < 0 deletes.
	c.SetCookie(accessCookieName, "", -1, "/", "", secure, true)
	c.SetCookie(refreshCookieName, "", -1, "/", "", secure, true)
	c.SetCookie(csrfCookieName, "", -1, "/", "", secure, false)
}

func getSessionLimit(ctx context.Context, pool *pgxpool.Pool, userID string, role string) int {
	// Defaults: keep it conservative.
	defaultLimit := 3

	var userLimit int
	err := pool.QueryRow(ctx, `select max_active_sessions from auth_session_limits_user where user_id=$1`, userID).Scan(&userLimit)
	if err == nil {
		if userLimit < 1 {
			return defaultLimit
		}
		if userLimit > 50 {
			return 50
		}
		return userLimit
	}

	var roleLimit int
	err = pool.QueryRow(ctx, `select max_active_sessions from auth_session_limits_role where role=$1`, role).Scan(&roleLimit)
	if err == nil {
		if roleLimit < 1 {
			return defaultLimit
		}
		if roleLimit > 50 {
			return 50
		}
		return roleLimit
	}

	return defaultLimit
}

func revokeSession(ctx context.Context, pool *pgxpool.Pool, sessionID string, reason string) {
	_, _ = pool.Exec(ctx, `update auth_sessions set revoked_at=now(), revoked_reason=$2 where id=$1 and revoked_at is null`, sessionID, reason)
	_, _ = pool.Exec(ctx, `update auth_refresh_tokens set revoked_at=now() where session_id=$1 and revoked_at is null`, sessionID)
}

func enforceSessionLimit(ctx context.Context, pool *pgxpool.Pool, userID string, role string, newSessionWouldAdd bool, maxActive int) {
	if maxActive < 1 {
		return
	}
	rows, err := pool.Query(ctx, `select id from auth_sessions where user_id=$1 and role=$2 and revoked_at is null and expires_at > now() order by created_at asc`, userID, role)
	if err != nil {
		return
	}
	defer rows.Close()

	ids := make([]string, 0, maxActive+2)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}

	allowed := maxActive
	if newSessionWouldAdd {
		allowed = maxActive - 1
		if allowed < 0 {
			allowed = 0
		}
	}
	if len(ids) <= allowed {
		return
	}
	toRevoke := ids[:len(ids)-allowed]
	for _, sid := range toRevoke {
		revokeSession(ctx, pool, sid, "session_limit")
	}
}

func loadUser(ctx context.Context, pool *pgxpool.Pool, userID string) (UserResponse, bool) {
	var email string
	var createdAt time.Time
	var role string
	err := pool.QueryRow(ctx, `select email, created_at, role from users where id=$1 and deleted_at is null`, userID).Scan(&email, &createdAt, &role)
	if err != nil {
		return UserResponse{}, false
	}
	return UserResponse{ID: userID, Email: email, Role: role, CreatedAt: createdAt.UTC().Format(time.RFC3339)}, true
}

func handleRegister(r *gin.Engine, pool *pgxpool.Pool, path string, role string, audience string) {
	r.POST(path, func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}

		email := strings.TrimSpace(strings.ToLower(req.Email))
		if email == "" || req.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "email and password are required"})
			return
		}

		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to hash password"})
			return
		}

		userID := util.NewID("usr")
		ctx := context.Background()
		_, err = pool.Exec(ctx, `insert into users (id, email, password_hash, role) values ($1, $2, $3, $4)`, userID, email, hash, role)
		if err != nil {
			// cheap conflict detection
			c.JSON(http.StatusBadRequest, gin.H{"message": "user already exists or invalid"})
			return
		}

		var createdAt time.Time
		_ = pool.QueryRow(ctx, `select created_at from users where id=$1`, userID).Scan(&createdAt)

		limit := getSessionLimit(ctx, pool, userID, role)
		enforceSessionLimit(ctx, pool, userID, role, true, limit)

		sessionID := util.NewID("as")
		sessionTTL := 30 * 24 * time.Hour
		sessionExpiresAt := time.Now().UTC().Add(sessionTTL)
		ip := strings.TrimSpace(c.ClientIP())
		ua := strings.TrimSpace(c.GetHeader("User-Agent"))
		_, _ = pool.Exec(ctx, `insert into auth_sessions (id, user_id, role, audience, ip, user_agent, expires_at) values ($1,$2,$3,$4,$5,$6,$7)`,
			sessionID, userID, role, audience, ip, ua, sessionExpiresAt)

		accessTTL := 15 * time.Minute
		token, err := auth.IssueAccessToken(userID, role, audience, sessionID, accessTTL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue token"})
			return
		}

		refreshToken, err := auth.NewOpaqueToken(32)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue refresh token"})
			return
		}
		refreshID := util.NewID("rt")
		refreshExpiresAt := time.Now().UTC().Add(sessionTTL)
		_, _ = pool.Exec(ctx, `insert into auth_refresh_tokens (id, session_id, token_hash, expires_at) values ($1,$2,$3,$4)`,
			refreshID, sessionID, auth.HashOpaqueToken(refreshToken), refreshExpiresAt)

		csrfToken, _ := auth.NewOpaqueToken(16)
		setAuthCookies(c, token, refreshToken, csrfToken, accessTTL, sessionTTL)

		userResp, _ := loadUser(ctx, pool, userID)

		c.JSON(http.StatusOK, AuthResponse{
			AccessToken: token,
			User:        userResp,
		})
	})
}

func handleLogin(r *gin.Engine, pool *pgxpool.Pool, path string, role string, audience string) {
	r.POST(path, func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid json body"})
			return
		}

		email := strings.TrimSpace(strings.ToLower(req.Email))
		if email == "" || req.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "email and password are required"})
			return
		}

		ctx := context.Background()
		var userID string
		var passwordHash string
		var createdAt time.Time
		var storedRole string
		err := pool.QueryRow(ctx, `select id, password_hash, created_at, role from users where email=$1 and role=$2 and deleted_at is null`, email, role).
			Scan(&userID, &passwordHash, &createdAt, &storedRole)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid credentials"})
			return
		}

		if !auth.VerifyPassword(passwordHash, req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid credentials"})
			return
		}

		limit := getSessionLimit(ctx, pool, userID, storedRole)
		enforceSessionLimit(ctx, pool, userID, storedRole, true, limit)

		sessionID := util.NewID("as")
		sessionTTL := 30 * 24 * time.Hour
		sessionExpiresAt := time.Now().UTC().Add(sessionTTL)
		ip := strings.TrimSpace(c.ClientIP())
		ua := strings.TrimSpace(c.GetHeader("User-Agent"))
		_, _ = pool.Exec(ctx, `insert into auth_sessions (id, user_id, role, audience, ip, user_agent, expires_at) values ($1,$2,$3,$4,$5,$6,$7)`,
			sessionID, userID, storedRole, audience, ip, ua, sessionExpiresAt)

		accessTTL := 15 * time.Minute
		token, err := auth.IssueAccessToken(userID, storedRole, audience, sessionID, accessTTL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue token"})
			return
		}

		refreshToken, err := auth.NewOpaqueToken(32)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue refresh token"})
			return
		}
		refreshID := util.NewID("rt")
		refreshExpiresAt := time.Now().UTC().Add(sessionTTL)
		_, _ = pool.Exec(ctx, `insert into auth_refresh_tokens (id, session_id, token_hash, expires_at) values ($1,$2,$3,$4)`,
			refreshID, sessionID, auth.HashOpaqueToken(refreshToken), refreshExpiresAt)

		csrfToken, _ := auth.NewOpaqueToken(16)
		setAuthCookies(c, token, refreshToken, csrfToken, accessTTL, sessionTTL)

		userResp, _ := loadUser(ctx, pool, userID)

		c.JSON(http.StatusOK, AuthResponse{
			AccessToken: token,
			User:        userResp,
		})
	})
}

func handleRefresh(r *gin.Engine, pool *pgxpool.Pool, path string, expectedRole string, expectedAudience string) {
	r.POST(path, func(c *gin.Context) {
		raw, err := c.Cookie(refreshCookieName)
		if err != nil || strings.TrimSpace(raw) == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}
		hash := auth.HashOpaqueToken(strings.TrimSpace(raw))

		ctx := context.Background()
		var refreshID string
		var sessionID string
		var userID string
		var role string
		var audience string
		err = pool.QueryRow(ctx, `select t.id, s.id, s.user_id, s.role, s.audience
			from auth_refresh_tokens t
			join auth_sessions s on s.id=t.session_id
			where t.token_hash=$1 and t.revoked_at is null and t.expires_at > now()
				and s.revoked_at is null and s.expires_at > now()`, hash).
			Scan(&refreshID, &sessionID, &userID, &role, &audience)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}
		if expectedRole != "" && role != expectedRole {
			c.JSON(http.StatusForbidden, gin.H{"message": "forbidden"})
			return
		}
		if expectedAudience != "" && audience != expectedAudience {
			c.JSON(http.StatusForbidden, gin.H{"message": "forbidden"})
			return
		}

		newRefreshToken, err := auth.NewOpaqueToken(32)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to rotate refresh token"})
			return
		}
		newRefreshID := util.NewID("rt")
		sessionTTL := 30 * 24 * time.Hour
		refreshExpiresAt := time.Now().UTC().Add(sessionTTL)
		_, _ = pool.Exec(ctx, `insert into auth_refresh_tokens (id, session_id, token_hash, expires_at) values ($1,$2,$3,$4)`,
			newRefreshID, sessionID, auth.HashOpaqueToken(newRefreshToken), refreshExpiresAt)
		_, _ = pool.Exec(ctx, `update auth_refresh_tokens set revoked_at=now(), replaced_by_token_id=$2 where id=$1 and revoked_at is null`, refreshID, newRefreshID)
		_, _ = pool.Exec(ctx, `update auth_sessions set last_seen_at=now() where id=$1`, sessionID)

		accessTTL := 15 * time.Minute
		accessToken, err := auth.IssueAccessToken(userID, role, audience, sessionID, accessTTL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to issue token"})
			return
		}

		csrfToken, _ := auth.NewOpaqueToken(16)
		setAuthCookies(c, accessToken, newRefreshToken, csrfToken, accessTTL, sessionTTL)

		userResp, ok := loadUser(ctx, pool, userID)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}
		c.JSON(http.StatusOK, AuthResponse{AccessToken: accessToken, User: userResp})
	})
}

func handleLogout(r *gin.Engine, pool *pgxpool.Pool, path string) {
	r.POST(path, func(c *gin.Context) {
		ctx := context.Background()
		// Prefer access token session id.
		if rawAccess, err := c.Cookie(accessCookieName); err == nil {
			claims, err := auth.ParseAccessToken(strings.TrimSpace(rawAccess))
			if err == nil && claims.Subject != "" && claims.SessionID != "" {
				revokeSession(ctx, pool, claims.SessionID, "logout")
				clearAuthCookies(c)
				c.JSON(http.StatusOK, OkResponse{Ok: true})
				return
			}
		}

		// Fallback: use refresh cookie to identify session.
		rawRefresh, err := c.Cookie(refreshCookieName)
		if err == nil && strings.TrimSpace(rawRefresh) != "" {
			hash := auth.HashOpaqueToken(strings.TrimSpace(rawRefresh))
			var sessionID string
			_ = pool.QueryRow(ctx, `select session_id from auth_refresh_tokens where token_hash=$1`, hash).Scan(&sessionID)
			if sessionID != "" {
				revokeSession(ctx, pool, sessionID, "logout")
			}
		}

		clearAuthCookies(c)
		c.JSON(http.StatusOK, OkResponse{Ok: true})
	})
}

func handleLogoutAll(r *gin.Engine, pool *pgxpool.Pool, path string, role string, audience string) {
	r.POST(path, auth.RequirePortalAuth(pool, role, audience), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}
		ctx := context.Background()
		_, _ = pool.Exec(ctx, `update auth_sessions set revoked_at=now(), revoked_reason='logout_all' where user_id=$1 and revoked_at is null`, userID)
		_, _ = pool.Exec(ctx, `update auth_refresh_tokens set revoked_at=now() where session_id in (select id from auth_sessions where user_id=$1) and revoked_at is null`, userID)
		clearAuthCookies(c)
		c.JSON(http.StatusOK, OkResponse{Ok: true})
	})
}

func handleMe(r *gin.Engine, pool *pgxpool.Pool, path string, role string, audience string) {
	r.GET(path, auth.RequirePortalAuth(pool, role, audience), func(c *gin.Context) {
		userID, ok := auth.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		ctx := context.Background()
		var email string
		var createdAt time.Time
		var storedRole string
		err := pool.QueryRow(ctx, `select email, created_at, role from users where id=$1 and deleted_at is null`, userID).Scan(&email, &createdAt, &storedRole)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
			return
		}

		c.JSON(http.StatusOK, UserResponse{ID: userID, Email: email, Role: storedRole, CreatedAt: createdAt.UTC().Format(time.RFC3339)})
	})
}

func RegisterAuthRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	// Portal-specific routes
	handleRegister(r, pool, "/student/auth/register", roleStudent, roleStudent)
	handleLogin(r, pool, "/student/auth/login", roleStudent, roleStudent)
	handleMe(r, pool, "/student/auth/me", roleStudent, roleStudent)
	handleRefresh(r, pool, "/student/auth/refresh", roleStudent, roleStudent)
	handleLogout(r, pool, "/student/auth/logout")
	handleLogoutAll(r, pool, "/student/auth/logout-all", roleStudent, roleStudent)

	handleLogin(r, pool, "/instructor/auth/login", roleInstructor, roleInstructor)
	handleMe(r, pool, "/instructor/auth/me", roleInstructor, roleInstructor)
	handleRefresh(r, pool, "/instructor/auth/refresh", roleInstructor, roleInstructor)
	handleLogout(r, pool, "/instructor/auth/logout")
	handleLogoutAll(r, pool, "/instructor/auth/logout-all", roleInstructor, roleInstructor)

	handleLogin(r, pool, "/admin/auth/login", roleAdmin, roleAdmin)
	handleMe(r, pool, "/admin/auth/me", roleAdmin, roleAdmin)
	handleRefresh(r, pool, "/admin/auth/refresh", roleAdmin, roleAdmin)
	handleLogout(r, pool, "/admin/auth/logout")
	handleLogoutAll(r, pool, "/admin/auth/logout-all", roleAdmin, roleAdmin)

	// Legacy aliases (treated as student portal)
	handleRegister(r, pool, "/auth/register", roleStudent, roleStudent)
	handleLogin(r, pool, "/auth/login", roleStudent, roleStudent)
	handleMe(r, pool, "/auth/me", roleStudent, roleStudent)
	handleRefresh(r, pool, "/auth/refresh", roleStudent, roleStudent)
	handleLogout(r, pool, "/auth/logout")
	handleLogoutAll(r, pool, "/auth/logout-all", roleStudent, roleStudent)
}
