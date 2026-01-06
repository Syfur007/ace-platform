package auth

import (
    "os"
    "testing"
    "time"
)

func TestIssueAndParseAccessToken(t *testing.T) {
    // set required envs
    prevSecret := os.Getenv("JWT_SECRET")
    prevIssuer := os.Getenv("JWT_ISSUER")
    prevAud := os.Getenv("JWT_AUDIENCE")
    defer os.Setenv("JWT_SECRET", prevSecret)
    defer os.Setenv("JWT_ISSUER", prevIssuer)
    defer os.Setenv("JWT_AUDIENCE", prevAud)

    os.Setenv("JWT_SECRET", "test-secret-1")
    os.Setenv("JWT_ISSUER", "test-issuer")
    os.Unsetenv("JWT_AUDIENCE")

    token, err := IssueAccessToken("user1", "student", "aud1", "sess1", time.Minute*5)
    if err != nil {
        t.Fatalf("IssueAccessToken error: %v", err)
    }

    claims, err := ParseAccessToken(token)
    if err != nil {
        t.Fatalf("ParseAccessToken error: %v", err)
    }
    if claims.Subject != "user1" || claims.Role != "student" || claims.SessionID != "sess1" {
        t.Fatalf("unexpected claims: %+v", claims)
    }

    // test audience enforcement via env
    os.Setenv("JWT_AUDIENCE", "aud2")
    token2, err := IssueAccessToken("user2", "student", "aud2", "sess2", time.Minute*5)
    if err != nil {
        t.Fatalf("IssueAccessToken error: %v", err)
    }
    if _, err := ParseAccessToken(token2); err != nil {
        t.Fatalf("expected token2 to parse: %v", err)
    }

    // token with wrong audience should fail when JWT_AUDIENCE set
    tokenWrongAud, err := IssueAccessToken("user3", "student", "other-aud", "sess3", time.Minute*5)
    if err != nil {
        t.Fatalf("IssueAccessToken error: %v", err)
    }
    if _, err := ParseAccessToken(tokenWrongAud); err == nil {
        t.Fatalf("expected parse to fail for wrong audience")
    }
}

func TestExpiredToken(t *testing.T) {
    prev := os.Getenv("JWT_SECRET")
    defer os.Setenv("JWT_SECRET", prev)
    os.Setenv("JWT_SECRET", "test-secret-2")
    os.Setenv("JWT_ISSUER", "")

    token, err := IssueAccessToken("u", "r", "", "s", -time.Minute)
    if err != nil {
        t.Fatalf("Issue error: %v", err)
    }
    if _, err := ParseAccessToken(token); err == nil {
        t.Fatalf("expected expired token to fail")
    }
}
