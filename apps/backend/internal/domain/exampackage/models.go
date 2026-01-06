package exampackage

import (
	"encoding/json"
	"time"
)

// ModuleSection represents a logical section of an exam package module.
// Domain model: no JSON tags.
type ModuleSection struct {
	ID          string
	Name        string
	Description string
}

// ExamPackage is the domain model for an exam package.
type ExamPackage struct {
	ID             string
	Code           string
	Name           string
	Subtitle       *string
	Overview       *string
	Modules        []string
	Highlights     []string
	ModuleSections []ModuleSection
	IsHidden       bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ExamPackageTier is the domain model for a tier within an exam package.
type ExamPackageTier struct {
	ID            string
	ExamPackageID string
	Code          string
	Name          string
	SortOrder     int
	IsDefault     bool
	IsActive      bool
	Policy        json.RawMessage
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Enrollment represents a user's enrollment in a package.
type Enrollment struct {
	UserID        string
	ExamPackageID string
	// TierID may be nil if not assigned
	TierID    *string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// EnrollmentEvent is an audit event for enrollment changes.
type EnrollmentEvent struct {
	UserID          string
	ExamPackageID   string
	FromTierID      *string
	ToTierID        *string
	ChangedByUserID string
	Reason          string
	CreatedAt       time.Time
}
