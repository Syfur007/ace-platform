package exampackage

import (
	"context"
	"fmt"
)

// AuditFunc is used by the service to emit audit logs. Handlers should provide a wrapper
// to the existing audit(...) helper which closes over the DB pool.
type AuditFunc func(ctx context.Context, actorUserID, actorRole, action, targetType, targetID string, metadata any)

// ExamPackageService holds business logic and depends on the repository interface.
type ExamPackageService struct {
	repo  ExamPackageRepository
	audit AuditFunc
}

func NewService(repo ExamPackageRepository, auditFn AuditFunc) *ExamPackageService {
	return &ExamPackageService{repo: repo, audit: auditFn}
}

func (s *ExamPackageService) ListPackages(ctx context.Context, showHidden bool) ([]ExamPackage, error) {
	return s.repo.ListPackages(ctx, showHidden)
}

func (s *ExamPackageService) ListTiers(ctx context.Context, packageID string, activeOnly bool) ([]ExamPackageTier, error) {
	return s.repo.ListTiersByPackageID(ctx, packageID, activeOnly)
}

func (s *ExamPackageService) GetTierByID(ctx context.Context, tierID string, packageID string) (*ExamPackageTier, error) {
	return s.repo.GetTierByID(ctx, tierID, packageID)
}

func (s *ExamPackageService) GetPackageByID(ctx context.Context, id string) (*ExamPackage, error) {
	return s.repo.GetPackageByID(ctx, id)
}

// CreateTier creates a new tier and optionally marks it default (unsetting others).
// actor details are used for audit logging; pass empty strings when not applicable.
func (s *ExamPackageService) CreateTier(ctx context.Context, actorUserID, actorRole string, t *ExamPackageTier) (string, error) {
	// ensure package exists
	if _, err := s.repo.GetPackageByID(ctx, t.ExamPackageID); err != nil {
		return "", ErrPackageNotFound
	}

	id, err := s.repo.CreateTier(ctx, t)
	if err != nil {
		return "", fmt.Errorf("create tier: %w", err)
	}

	if t.IsDefault {
		_ = s.repo.SetDefaultTier(ctx, t.ExamPackageID, id)
	}

	if s.audit != nil {
		s.audit(ctx, actorUserID, actorRole, "instructor.exam_package_tiers.create", "exam_package_tier", id, map[string]string{"examPackageId": t.ExamPackageID, "code": t.Code, "name": t.Name})
	}

	return id, nil
}

func (s *ExamPackageService) UpdateTier(ctx context.Context, actorUserID, actorRole string, t *ExamPackageTier) error {
	// verify tier exists
	if _, err := s.repo.GetTierByID(ctx, t.ID, t.ExamPackageID); err != nil {
		return ErrTierNotFound
	}

	if err := s.repo.UpdateTier(ctx, t); err != nil {
		return fmt.Errorf("update tier: %w", err)
	}

	if t.IsDefault {
		_ = s.repo.SetDefaultTier(ctx, t.ExamPackageID, t.ID)
	}

	if s.audit != nil {
		s.audit(ctx, actorUserID, actorRole, "instructor.exam_package_tiers.update", "exam_package_tier", t.ID, t)
	}
	return nil
}

func (s *ExamPackageService) DeleteTier(ctx context.Context, actorUserID, actorRole string, tierID string, packageID string) error {
	// verify exists and not default
	t, err := s.repo.GetTierByID(ctx, tierID, packageID)
	if err != nil {
		return ErrTierNotFound
	}
	if t.IsDefault {
		return fmt.Errorf("%w: cannot delete default tier", ErrInvalidTier)
	}
	if err := s.repo.DeleteTier(ctx, tierID, packageID); err != nil {
		return fmt.Errorf("delete tier: %w", err)
	}
	if s.audit != nil {
		s.audit(ctx, actorUserID, actorRole, "instructor.exam_package_tiers.delete", "exam_package_tier", tierID, map[string]string{"examPackageId": packageID})
	}
	return nil
}

// EnrollUser enrolls a user into a package, resolving tiers and recording an event when appropriate.
func (s *ExamPackageService) EnrollUser(ctx context.Context, userID string, packageID string, desiredTierID *string) error {
	// ensure package exists and is not hidden
	p, err := s.repo.GetPackageByID(ctx, packageID)
	if err != nil || p == nil || p.IsHidden {
		return ErrPackageNotFound
	}

	var tierID string
	if desiredTierID != nil && *desiredTierID != "" {
		// validate provided tier
		if _, err := s.repo.GetTierByID(ctx, *desiredTierID, packageID); err != nil {
			return ErrInvalidTier
		}
		tierID = *desiredTierID
	} else {
		// find first active tier in order of default, sort_order
		tiers, err := s.repo.ListTiersByPackageID(ctx, packageID, true)
		if err != nil || len(tiers) == 0 {
			return fmt.Errorf("package has no active tier")
		}
		tierID = tiers[0].ID
	}

	e := &Enrollment{UserID: userID, ExamPackageID: packageID, TierID: &tierID}
	inserted, err := s.repo.CreateOrUpdateEnrollment(ctx, e)
	if err != nil {
		return fmt.Errorf("enroll user: %w", err)
	}
	if inserted {
		_ = s.repo.RecordEnrollmentEvent(ctx, &EnrollmentEvent{UserID: userID, ExamPackageID: packageID, FromTierID: nil, ToTierID: &tierID, ChangedByUserID: userID, Reason: "enroll"})
	}
	return nil
}

func (s *ExamPackageService) ChangeTier(ctx context.Context, userID string, packageID string, newTierID string) error {
	// verify enrollment exists
	if _, err := s.repo.GetEnrollment(ctx, userID, packageID); err != nil {
		return ErrNotEnrolled
	}
	// validate tier
	if _, err := s.repo.GetTierByID(ctx, newTierID, packageID); err != nil {
		return ErrInvalidTier
	}
	if err := s.repo.UpdateEnrollmentTier(ctx, userID, packageID, newTierID); err != nil {
		return fmt.Errorf("change tier: %w", err)
	}
	_ = s.repo.RecordEnrollmentEvent(ctx, &EnrollmentEvent{UserID: userID, ExamPackageID: packageID, FromTierID: nil, ToTierID: &newTierID, ChangedByUserID: userID, Reason: "change_tier"})
	return nil
}

func (s *ExamPackageService) DeleteEnrollment(ctx context.Context, userID string, packageID string) error {
	if err := s.repo.DeleteEnrollment(ctx, userID, packageID); err != nil {
		return fmt.Errorf("delete enrollment: %w", err)
	}
	return nil
}
