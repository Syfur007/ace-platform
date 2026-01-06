package exampackage

import "context"

// ExamPackageRepository defines persistence operations for exam packages and enrollments.
// Implementations should wrap SQL errors appropriately and return domain errors where applicable.
type ExamPackageRepository interface {
	ListPackages(ctx context.Context, showHidden bool) ([]ExamPackage, error)
	GetPackageByID(ctx context.Context, id string) (*ExamPackage, error)

	ListTiersByPackageID(ctx context.Context, packageID string, activeOnly bool) ([]ExamPackageTier, error)
	GetTierByID(ctx context.Context, tierID string, packageID string) (*ExamPackageTier, error)
	CreateTier(ctx context.Context, t *ExamPackageTier) (string, error)
	UpdateTier(ctx context.Context, t *ExamPackageTier) error
	DeleteTier(ctx context.Context, tierID string, packageID string) error
		// SetDefaultTier sets the provided tier as default for a package and unsets others.
		SetDefaultTier(ctx context.Context, packageID string, tierID string) error
	UpdateEnrollmentTier(ctx context.Context, userID string, packageID string, newTierID string) error
	DeleteEnrollment(ctx context.Context, userID string, packageID string) error

	RecordEnrollmentEvent(ctx context.Context, ev *EnrollmentEvent) error
}
