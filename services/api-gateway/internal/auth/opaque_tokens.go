package auth

import (
	"crypto/rand"
	"crypto/sha256"
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
