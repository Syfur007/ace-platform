package auth

import (
    "os"
    "testing"
)

func TestHashAndVerifyPassword(t *testing.T) {
    prev := os.Getenv("BCRYPT_COST")
    defer os.Setenv("BCRYPT_COST", prev)
    os.Unsetenv("BCRYPT_COST")

    hash, err := HashPassword("secret123")
    if err != nil {
        t.Fatalf("HashPassword error: %v", err)
    }
    if !VerifyPassword(hash, "secret123") {
        t.Fatalf("VerifyPassword failed")
    }
}

func TestInvalidBcryptCost(t *testing.T) {
    prev := os.Getenv("BCRYPT_COST")
    defer os.Setenv("BCRYPT_COST", prev)
    os.Setenv("BCRYPT_COST", "not-a-number")
    if _, err := HashPassword("p"); err == nil {
        t.Fatalf("expected error for invalid bcrypt cost")
    }
}
