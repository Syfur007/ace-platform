package util

import (
	"crypto/rand"
	"encoding/hex"
)

func NewID(prefix string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	if prefix == "" {
		return hex.EncodeToString(b)
	}
	return prefix + "_" + hex.EncodeToString(b)
}
