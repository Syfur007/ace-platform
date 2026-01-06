package auth

import (
    "testing"
)

func TestGenerateAndVerifyOpaqueToken(t *testing.T) {
    token, hash, err := GenerateAndHashOpaqueToken(32)
    if err != nil {
        t.Fatalf("generate error: %v", err)
    }
    if token == "" || len(hash) == 0 {
        t.Fatalf("unexpected token/hash")
    }
    if !VerifyOpaqueToken(hash, token) {
        t.Fatalf("verification failed")
    }
    if VerifyOpaqueToken(hash, token+"x") {
        t.Fatalf("verification should fail for altered token")
    }
}
