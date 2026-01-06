package exampackage

import (
	"context"
	"errors"
	"testing"
)

// simple mock repository used for testing service logic
type mockRepo struct {
	packages map[string]ExamPackage
	tiers    map[string][]ExamPackageTier // packageID -> tiers
	enrolls  map[string]Enrollment        // key userID|packageID

	createdEnrollment bool
	recordedEvent     bool
}

func (m *mockRepo) ListPackages(ctx context.Context, showHidden bool) ([]ExamPackage, error) {
	out := []ExamPackage{}
	for _, p := range m.packages {
		if !showHidden && p.IsHidden {
			continue
		}
		out = append(out, p)
	}
	return out, nil
}
func (m *mockRepo) GetPackageByID(ctx context.Context, id string) (*ExamPackage, error) {
	p, ok := m.packages[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return &p, nil
}
func (m *mockRepo) ListTiersByPackageID(ctx context.Context, packageID string, activeOnly bool) ([]ExamPackageTier, error) {
	t, ok := m.tiers[packageID]
	if !ok {
		return []ExamPackageTier{}, nil
	}
	if activeOnly {
		out := []ExamPackageTier{}
		for _, v := range t {
			if v.IsActive {
				out = append(out, v)
			}
		}
		return out, nil
	}
	return t, nil
}
func (m *mockRepo) GetTierByID(ctx context.Context, tierID string, packageID string) (*ExamPackageTier, error) {
	if tlist, ok := m.tiers[packageID]; ok {
		for _, t := range tlist {
			if t.ID == tierID {
				return &t, nil
			}
		}
	}
	return nil, errors.New("not found")
}
func (m *mockRepo) CreateTier(ctx context.Context, t *ExamPackageTier) (string, error) { return "", nil }
func (m *mockRepo) UpdateTier(ctx context.Context, t *ExamPackageTier) error { return nil }
func (m *mockRepo) DeleteTier(ctx context.Context, tierID string, packageID string) error { return nil }
func (m *mockRepo) SetDefaultTier(ctx context.Context, packageID string, tierID string) error { return nil }
func (m *mockRepo) GetEnrollment(ctx context.Context, userID string, packageID string) (*Enrollment, error) {
	k := userID + "|" + packageID
	if e, ok := m.enrolls[k]; ok {
		return &e, nil
	}
	return nil, errors.New("not found")
}
func (m *mockRepo) CreateOrUpdateEnrollment(ctx context.Context, e *Enrollment) (bool, error) {
	k := e.UserID + "|" + e.ExamPackageID
	m.enrolls[k] = *e
	m.createdEnrollment = true
	return true, nil
}
func (m *mockRepo) UpdateEnrollmentTier(ctx context.Context, userID string, packageID string, newTierID string) error {
	k := userID + "|" + packageID
	if ee, ok := m.enrolls[k]; ok {
		ee.TierID = &newTierID
		m.enrolls[k] = ee
		return nil
	}
	return errors.New("not found")
}
func (m *mockRepo) DeleteEnrollment(ctx context.Context, userID string, packageID string) error {
	k := userID + "|" + packageID
	delete(m.enrolls, k)
	return nil
}
func (m *mockRepo) RecordEnrollmentEvent(ctx context.Context, ev *EnrollmentEvent) error {
	m.recordedEvent = true
	return nil
}

func TestEnrollUser_Success(t *testing.T) {
	m := &mockRepo{packages: map[string]ExamPackage{"pkg1": {ID: "pkg1", IsHidden: false}}, tiers: map[string][]ExamPackageTier{"pkg1": {{ID: "tier1", ExamPackageID: "pkg1", IsActive: true}}}, enrolls: map[string]Enrollment{}}
	svc := NewService(m, nil)
	if err := svc.EnrollUser(context.Background(), "user1", "pkg1", nil); err != nil {
		t.Fatalf("EnrollUser failed: %v", err)
	}
	if !m.createdEnrollment {
		t.Fatalf("expected enrollment to be created")
	}
	if !m.recordedEvent {
		t.Fatalf("expected event to be recorded")
	}
}

func TestEnrollUser_PackageNotFound(t *testing.T) {
	m := &mockRepo{packages: map[string]ExamPackage{}, tiers: map[string][]ExamPackageTier{}, enrolls: map[string]Enrollment{}}
	svc := NewService(m, nil)
	if err := svc.EnrollUser(context.Background(), "user1", "pkg1", nil); err == nil {
		t.Fatalf("expected error when package not found")
	}
}

func TestChangeTier_NotEnrolled(t *testing.T) {
	m := &mockRepo{packages: map[string]ExamPackage{"pkg1": {ID: "pkg1"}}, tiers: map[string][]ExamPackageTier{"pkg1": {{ID: "t1", ExamPackageID: "pkg1", IsActive: true}}}, enrolls: map[string]Enrollment{}}
	svc := NewService(m, nil)
	if err := svc.ChangeTier(context.Background(), "user1", "pkg1", "t1"); err == nil {
		t.Fatalf("expected error when not enrolled")
	}
}

func TestChangeTier_Success(t *testing.T) {
	m := &mockRepo{packages: map[string]ExamPackage{"pkg1": {ID: "pkg1"}}, tiers: map[string][]ExamPackageTier{"pkg1": {{ID: "t1", ExamPackageID: "pkg1", IsActive: true}, {ID: "t2", ExamPackageID: "pkg1", IsActive: true}}}, enrolls: map[string]Enrollment{"user1|pkg1": {UserID: "user1", ExamPackageID: "pkg1", TierID: &([]string{"t1"}[0])}}}
	svc := NewService(m, nil)
	if err := svc.ChangeTier(context.Background(), "user1", "pkg1", "t2"); err != nil {
		t.Fatalf("ChangeTier failed: %v", err)
	}
	k := "user1|pkg1"
	if e, ok := m.enrolls[k]; !ok || e.TierID == nil || *e.TierID != "t2" {
		t.Fatalf("expected tier to be changed to t2, got %+v", e)
	}
}

func TestCreateTier_AuditCalled(t *testing.T) {
	m := &mockRepo{packages: map[string]ExamPackage{"pkg1": {ID: "pkg1"}}}
	auditCalled := false
	auditFn := func(ctx context.Context, actorUserID, actorRole, action, targetType, targetID string, metadata any) {
		auditCalled = true
	}
	svc := NewService(m, auditFn)
	tier := &ExamPackageTier{ExamPackageID: "pkg1", Code: "code", Name: "name", SortOrder: 1, IsActive: true, IsDefault: true}
	if _, err := svc.CreateTier(context.Background(), "actor1", "instructor", tier); err != nil {
		t.Fatalf("CreateTier failed: %v", err)
	}
	if !auditCalled {
		t.Fatalf("expected audit to be called")
	}
}
