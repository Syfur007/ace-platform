package exampackage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) ListPackages(ctx context.Context, showHidden bool) ([]ExamPackage, error) {
	q := `
		select id::text, code, name, subtitle, overview, modules, highlights, module_sections, is_hidden, created_at, updated_at
		from exam_packages`
	if !showHidden {
		q += " where is_hidden=false"
	}
	q += " order by name asc"

	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list packages: %w", err)
	}
	defer rows.Close()

	out := []ExamPackage{}
	for rows.Next() {
		var p ExamPackage
		var modulesRaw []byte
		var highlightsRaw []byte
		var moduleSectionsRaw []byte
		if err := rows.Scan(&p.ID, &p.Code, &p.Name, &p.Subtitle, &p.Overview, &modulesRaw, &highlightsRaw, &moduleSectionsRaw, &p.IsHidden, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan package: %w", err)
		}
		if len(modulesRaw) > 0 {
			_ = json.Unmarshal(modulesRaw, &p.Modules)
		}
		if len(highlightsRaw) > 0 {
			_ = json.Unmarshal(highlightsRaw, &p.Highlights)
		}
		if len(moduleSectionsRaw) > 0 {
			_ = json.Unmarshal(moduleSectionsRaw, &p.ModuleSections)
		}
		out = append(out, p)
	}
	return out, nil
}

func (r *PostgresRepository) GetPackageByID(ctx context.Context, id string) (*ExamPackage, error) {
	var p ExamPackage
	var modulesRaw []byte
	var highlightsRaw []byte
	var moduleSectionsRaw []byte
	if err := r.pool.QueryRow(ctx, `
		select id::text, code, name, subtitle, overview, modules, highlights, module_sections, is_hidden, created_at, updated_at
		from exam_packages where id=$1`, id).Scan(&p.ID, &p.Code, &p.Name, &p.Subtitle, &p.Overview, &modulesRaw, &highlightsRaw, &moduleSectionsRaw, &p.IsHidden, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get package: %w", err)
	}
	if len(modulesRaw) > 0 {
		_ = json.Unmarshal(modulesRaw, &p.Modules)
	}
	if len(highlightsRaw) > 0 {
		_ = json.Unmarshal(highlightsRaw, &p.Highlights)
	}
	if len(moduleSectionsRaw) > 0 {
		_ = json.Unmarshal(moduleSectionsRaw, &p.ModuleSections)
	}
	return &p, nil
}

func (r *PostgresRepository) ListTiersByPackageID(ctx context.Context, packageID string, activeOnly bool) ([]ExamPackageTier, error) {
	q := `select id::text, exam_package_id::text, code, name, sort_order, is_default, is_active, policy, created_at, updated_at from exam_package_tiers where exam_package_id=$1`
	if activeOnly {
		q += " and is_active=true"
	}
	q += " order by sort_order asc, created_at asc"

	rows, err := r.pool.Query(ctx, q, packageID)
	if err != nil {
		return nil, fmt.Errorf("list tiers: %w", err)
	}
	defer rows.Close()

	out := []ExamPackageTier{}
	for rows.Next() {
		var t ExamPackageTier
		var policyRaw []byte
		if err := rows.Scan(&t.ID, &t.ExamPackageID, &t.Code, &t.Name, &t.SortOrder, &t.IsDefault, &t.IsActive, &policyRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan tier: %w", err)
		}
		if len(policyRaw) == 0 {
			policyRaw = []byte(`{}`)
		}
		t.Policy = policyRaw
		out = append(out, t)
	}
	return out, nil
}

func (r *PostgresRepository) GetTierByID(ctx context.Context, tierID string, packageID string) (*ExamPackageTier, error) {
	var t ExamPackageTier
	var policyRaw []byte
	if err := r.pool.QueryRow(ctx, `
		select id::text, exam_package_id::text, code, name, sort_order, is_default, is_active, policy, created_at, updated_at
		from exam_package_tiers where id=$1 and exam_package_id=$2`, tierID, packageID).Scan(&t.ID, &t.ExamPackageID, &t.Code, &t.Name, &t.SortOrder, &t.IsDefault, &t.IsActive, &policyRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, fmt.Errorf("get tier: %w", err)
	}
	if len(policyRaw) == 0 {
		policyRaw = []byte(`{}`)
	}
	t.Policy = policyRaw
	return &t, nil
}

func (r *PostgresRepository) CreateTier(ctx context.Context, t *ExamPackageTier) (string, error) {
	var newID string
	if t.Policy == nil {
		t.Policy = []byte(`{}`)
	}
	if err := r.pool.QueryRow(ctx, `
		insert into exam_package_tiers (exam_package_id, code, name, sort_order, is_default, is_active, policy)
		values ($1, $2, $3, $4, $5, $6, $7)
		returning id::text`, t.ExamPackageID, t.Code, t.Name, t.SortOrder, t.IsDefault, t.IsActive, t.Policy).Scan(&newID); err != nil {
		return "", fmt.Errorf("create tier: %w", err)
	}
	return newID, nil
}

func (r *PostgresRepository) UpdateTier(ctx context.Context, t *ExamPackageTier) error {
	// Only update fields that are non-zero/meaningful. For simplicity, update all fields except created_at.
	_, err := r.pool.Exec(ctx, `update exam_package_tiers set code=$1, name=$2, sort_order=$3, is_default=$4, is_active=$5, policy=$6, updated_at=now() where id=$7 and exam_package_id=$8`, t.Code, t.Name, t.SortOrder, t.IsDefault, t.IsActive, t.Policy, t.ID, t.ExamPackageID)
	if err != nil {
		return fmt.Errorf("update tier: %w", err)
	}
	return nil
}

// SetDefaultTier sets the given tier as default for the package and unsets other tiers.
func (r *PostgresRepository) SetDefaultTier(ctx context.Context, packageID string, tierID string) error {
	_, _ = r.pool.Exec(ctx, `update exam_package_tiers set is_default=false where exam_package_id=$1 and id<>$2`, packageID, tierID)
	_, err := r.pool.Exec(ctx, `update exam_package_tiers set is_default=true where id=$1`, tierID)
	if err != nil {
		return fmt.Errorf("set default tier: %w", err)
	}
	return nil
}

func (r *PostgresRepository) DeleteTier(ctx context.Context, tierID string, packageID string) error {
	ct, err := r.pool.Exec(ctx, `delete from exam_package_tiers where id=$1 and exam_package_id=$2`, tierID, packageID)
	if err != nil {
		return fmt.Errorf("delete tier: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("delete tier: no rows affected")
	}
	return nil
}

func (r *PostgresRepository) GetEnrollment(ctx context.Context, userID string, packageID string) (*Enrollment, error) {
	var e Enrollment
	var tierID *string
	if err := r.pool.QueryRow(ctx, `select exam_package_id::text, coalesce(tier_id::text, '') from user_exam_package_enrollments where user_id=$1 and exam_package_id=$2`, userID, packageID).Scan(&e.ExamPackageID, &tierID); err != nil {
		return nil, fmt.Errorf("get enrollment: %w", err)
	}
	if tierID != nil && *tierID != "" {
		e.TierID = tierID
	}
	// Note: created_at/updated_at omitted for brevity; can be added if needed
	return &e, nil
}

func (r *PostgresRepository) CreateOrUpdateEnrollment(ctx context.Context, e *Enrollment) (bool, error) {
	ct, err := r.pool.Exec(ctx, `
		insert into user_exam_package_enrollments (user_id, exam_package_id, tier_id)
		values ($1,$2,$3)
		on conflict (user_id, exam_package_id) do update set
			tier_id = coalesce(user_exam_package_enrollments.tier_id, excluded.tier_id),
			updated_at = case when user_exam_package_enrollments.tier_id is null then now() else user_exam_package_enrollments.updated_at end`, e.UserID, e.ExamPackageID, e.TierID)
	if err != nil {
		return false, fmt.Errorf("create or update enrollment: %w", err)
	}
	return ct.RowsAffected() > 0, nil
}

func (r *PostgresRepository) UpdateEnrollmentTier(ctx context.Context, userID string, packageID string, newTierID string) error {
	_, err := r.pool.Exec(ctx, `update user_exam_package_enrollments set tier_id=$3::uuid, updated_at=now() where user_id=$1 and exam_package_id=$2`, userID, packageID, newTierID)
	if err != nil {
		return fmt.Errorf("update enrollment tier: %w", err)
	}
	return nil
}

func (r *PostgresRepository) DeleteEnrollment(ctx context.Context, userID string, packageID string) error {
	_, err := r.pool.Exec(ctx, `delete from user_exam_package_enrollments where user_id=$1 and exam_package_id=$2`, userID, packageID)
	if err != nil {
		return fmt.Errorf("delete enrollment: %w", err)
	}
	return nil
}

func (r *PostgresRepository) RecordEnrollmentEvent(ctx context.Context, ev *EnrollmentEvent) error {
	_, err := r.pool.Exec(ctx, `
		insert into user_exam_package_enrollment_events (user_id, exam_package_id, from_tier_id, to_tier_id, changed_by_user_id, reason)
		values ($1,$2,$3::uuid,$4::uuid,$5,$6)`, ev.UserID, ev.ExamPackageID, ev.FromTierID, ev.ToTierID, ev.ChangedByUserID, ev.Reason)
	if err != nil {
		return fmt.Errorf("record enrollment event: %w", err)
	}
	return nil
}
