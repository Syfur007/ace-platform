-- 000009_seeds.up.sql
-- Purpose: Seed baseline reference data required by the application.
-- Risk: fast.
-- Reversible: mostly (see down).

-- Seed question bank difficulties (idempotent)
INSERT INTO question_bank_difficulties (id, display_name, sort_order)
VALUES
  ('easy', 'Easy', 1),
  ('medium', 'Medium', 2),
  ('hard', 'Hard', 3)
ON CONFLICT (id) DO NOTHING;

-- Seed exam packages (idempotent)
INSERT INTO exam_packages (code, name)
VALUES
  ('gre', 'GRE'),
  ('ielts', 'IELTS'),
  ('sat', 'SAT')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Seed a default tier per exam package (idempotent)
INSERT INTO exam_package_tiers (exam_package_id, code, name, sort_order, is_default, is_active, policy)
SELECT id, 'default', 'Default', 0, true, true, '{}'::json
FROM exam_packages
ON CONFLICT (exam_package_id, code) DO NOTHING;
