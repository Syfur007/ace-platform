package auth

import (
	"crypto/subtle"
	"errors"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	// exported errors for callers to map to HTTP responses
	ErrInvalidToken          = errors.New("auth: invalid token")
	ErrExpiredToken          = errors.New("auth: token expired")
	ErrInvalidSigningMethod  = errors.New("auth: invalid signing method")
	ErrMissingJWTSecret      = errors.New("auth: missing JWT secret")
)

// configurable signing method (default HS256)
var defaultSigningMethod = jwt.SigningMethodHS256

// Claims preserves previous public shape.
type Claims struct {
	jwt.RegisteredClaims
	Role      string `json:"role"`
	SessionID string `json:"sid"`
}

// getJWTSecret reads and validates the JWT secret. In production the secret
// must be set; to allow local/dev runs set DEV_MODE=true or ALLOW_DEV_JWT_SECRET=true.
func getJWTSecret() ([]byte, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		if os.Getenv("DEV_MODE") == "true" || os.Getenv("ALLOW_DEV_JWT_SECRET") == "true" {
			log.Print("DEBUG: auth: running in dev mode without JWT_SECRET set")
			return []byte("dev-secret-change-me"), nil
		}
		return nil, ErrMissingJWTSecret
	}
	return []byte(secret), nil
}

// GetJWTIssuer returns the configured JWT_ISSUER env var.
func GetJWTIssuer() string {
	return os.Getenv("JWT_ISSUER")
}

// GetJWTAudience returns optional JWT_AUDIENCE env var (may be empty).
func GetJWTAudience() string {
	return os.Getenv("JWT_AUDIENCE")
}

// IssueAccessToken signs a JWT with configured issuer and provided audience.
func IssueAccessToken(userID string, role string, audience string, sessionID string, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	aud := []string{}
	if audience != "" {
		aud = []string{audience}
	}
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Audience:  aud,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			Issuer:    GetJWTIssuer(),
		},
		Role:      role,
		SessionID: sessionID,
	}

	key, err := getJWTSecret()
	if err != nil {
		log.Print("FATAL: auth: missing JWT secret; set JWT_SECRET or enable DEV_MODE/ALLOW_DEV_JWT_SECRET")
		return "", err
	}

	token := jwt.NewWithClaims(defaultSigningMethod, claims)
	return token.SignedString(key)
}

// ParseAccessToken validates token signature, expiry, issuer and audience (when configured).
func ParseAccessToken(tokenString string) (*Claims, error) {
	keyFunc := func(token *jwt.Token) (interface{}, error) {
		// enforce signing method explicitly
		if token.Method == nil || token.Method.Alg() != defaultSigningMethod.Alg() {
			return nil, ErrInvalidSigningMethod
		}
		key, err := getJWTSecret()
		if err != nil {
			return nil, err
		}
		return key, nil
	}

	opts := []jwt.ParserOption{jwt.WithLeeway(0)}
	// validate issuer if set
	if iss := GetJWTIssuer(); iss != "" {
		opts = append(opts, jwt.WithIssuer(iss))
	}
	// validate audience if set
	if aud := GetJWTAudience(); aud != "" {
		opts = append(opts, jwt.WithAudience(aud))
	}

	parsed, err := jwt.ParseWithClaims(tokenString, &Claims{}, keyFunc, opts...)
	if err != nil {
		// map jwt library errors to our exported errors
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		// fallback: if error contains "invalid audience" or "invalid issuer" treat as invalid
		return nil, ErrInvalidToken
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, ErrInvalidToken
	}

	// Defensive check on RegisteredClaims expiry
	if claims.ExpiresAt != nil && time.Now().UTC().After(claims.ExpiresAt.Time) {
		return nil, ErrExpiredToken
	}

	// constant-time check for Issuer when configured
	if iss := GetJWTIssuer(); iss != "" {
		if subtle.ConstantTimeCompare([]byte(iss), []byte(claims.Issuer)) != 1 {
			return nil, ErrInvalidToken
		}
	}

	// Audience validation when configured is handled by jwt.ParseWithClaims above; keep this defensive.

	return claims, nil
}
