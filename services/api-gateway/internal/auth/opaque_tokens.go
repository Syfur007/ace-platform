package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
)

func NewOpaqueToken(numBytes int) (string, error) {
	if numBytes <= 0 {
		numBytes = 32
	}
	b := make([]byte, numBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func HashOpaqueToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

// GenerateAndHashOpaqueToken returns the plain token and its SHA-256 hash.
func GenerateAndHashOpaqueToken(numBytes int) (string, []byte, error) {
	t, err := NewOpaqueToken(numBytes)
	if err != nil {
		return "", nil, err
	}
	h := HashOpaqueToken(t)
	return t, h, nil
}

// VerifyOpaqueToken verifies token by hashing and using constant-time comparison.
func VerifyOpaqueToken(hash []byte, token string) bool {
	h := HashOpaqueToken(token)
	if len(h) != len(hash) {
		return false
	}
	return subtle.ConstantTimeCompare(h, hash) == 1
}
