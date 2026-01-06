package auth

import (
	"errors"
	"os"
	"strconv"

	"golang.org/x/crypto/bcrypt"
)

func getBcryptCost() (int, error) {
	v := os.Getenv("BCRYPT_COST")
	if v == "" {
		return bcrypt.DefaultCost, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, err
	}
	if n < bcrypt.MinCost || n > 31 {
		return 0, errors.New("invalid bcrypt cost")
	}
	return n, nil
}

func HashPassword(password string) (string, error) {
	cost, err := getBcryptCost()
	if err != nil {
		return "", err
	}
	b, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func VerifyPassword(hash string, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
