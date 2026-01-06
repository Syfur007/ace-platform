package exampackage

import "errors"

var (
	ErrPackageNotFound = errors.New("exam package not found")
	ErrTierNotFound = errors.New("tier not found")
	ErrNotEnrolled = errors.New("not enrolled in package")
	ErrInvalidTier = errors.New("invalid tier")
)
