-- Migration 025: Convert UUID primary keys to BIGSERIAL auto-incrementing integers
-- This migration replaces gen_random_uuid() PKs with BIGSERIAL across all data tables.
-- users.id and tenants.id are intentionally kept (prefixed employee ID / tenant code).
--
-- Strategy:
--   1. Truncate all affected tables (children first to respect FKs)
--   2. Drop and recreate tables with BIGSERIAL PKs + correct FK references
--   3. Re-seed system-level permissions and roles (truncated along with other tables)

-- ============================================================
-- STEP 1: Truncate all affected tables in dependency order
--         (children before parents)
-- ============================================================

TRUNCATE TABLE
    proctoring_logs,
    proctoring_sessions,
    test_violations,
    test_attempts,
    responses,
    results,
    candidates,
    assessment_questions,
    assessments,
    audit_logs,
    role_permissions,
    user_roles,
    manager_assignments,
    domains,
    questions
CASCADE;

-- Truncate roles and permissions separately (they have cross-references via role_permissions)
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE roles CASCADE;
TRUNCATE TABLE permissions CASCADE;

-- ============================================================
-- STEP 2: Drop old UUID columns and recreate with BIGSERIAL
-- ============================================================

-- ---- permissions ----
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_pkey CASCADE;
ALTER TABLE permissions DROP COLUMN id;
ALTER TABLE permissions ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- ---- roles ----
-- roles.tenant_id stays as TEXT (it stores the tenant code like "skills-0002")
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_pkey CASCADE;
ALTER TABLE roles ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::TEXT;
ALTER TABLE roles DROP COLUMN id;
ALTER TABLE roles ADD COLUMN id BIGSERIAL PRIMARY KEY;
-- Also drop the old UUID FK on created_by (references users.id which is now TEXT) — already TEXT compatible
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_created_by_fkey;
ALTER TABLE roles ADD CONSTRAINT roles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ---- role_permissions ----
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_pkey CASCADE;
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_permission_id_fkey;
ALTER TABLE role_permissions DROP COLUMN role_id;
ALTER TABLE role_permissions DROP COLUMN permission_id;
ALTER TABLE role_permissions ADD COLUMN role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE role_permissions ADD COLUMN permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE;
ALTER TABLE role_permissions ADD PRIMARY KEY (role_id, permission_id);

-- ---- user_roles ----
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE user_roles DROP COLUMN role_id;
ALTER TABLE user_roles ADD COLUMN role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE;

-- ---- domains ----
ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_pkey CASCADE;
ALTER TABLE domains DROP COLUMN id;
ALTER TABLE domains ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- ---- questions ----
-- questions.domain_id references domains.id (now BIGINT)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_pkey CASCADE;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_domain_id_fkey;
ALTER TABLE questions DROP COLUMN id;
ALTER TABLE questions ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE questions DROP COLUMN domain_id;
ALTER TABLE questions ADD COLUMN domain_id BIGINT REFERENCES domains(id) ON DELETE SET NULL;
-- users.domain_id references domains.id too — update that FK as well
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_domain_id_fkey;
ALTER TABLE users DROP COLUMN domain_id;
ALTER TABLE users ADD COLUMN domain_id BIGINT REFERENCES domains(id) ON DELETE SET NULL;

-- ---- assessments ----
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_pkey CASCADE;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS uq_assessments_tenant_title;
ALTER TABLE assessments DROP COLUMN id;
ALTER TABLE assessments ADD COLUMN id BIGSERIAL PRIMARY KEY;
-- Recreate unique constraint (title unique per tenant, derived from created_by prefix)
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessments_tenant_title
    ON assessments (split_part(created_by, '_', 1), title);

-- ---- assessment_questions ----
ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_pkey CASCADE;
ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_assessment_id_fkey;
ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_question_id_fkey;
ALTER TABLE assessment_questions DROP COLUMN id;
ALTER TABLE assessment_questions ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE assessment_questions DROP COLUMN assessment_id;
ALTER TABLE assessment_questions DROP COLUMN question_id;
ALTER TABLE assessment_questions ADD COLUMN assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE;
ALTER TABLE assessment_questions ADD COLUMN question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE;
ALTER TABLE assessment_questions ADD CONSTRAINT assessment_questions_assessment_question_unique UNIQUE (assessment_id, question_id);

-- ---- candidates ----
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_pkey CASCADE;
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_assessment_id_fkey;
ALTER TABLE candidates DROP COLUMN id;
ALTER TABLE candidates ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE candidates DROP COLUMN assessment_id;
ALTER TABLE candidates ADD COLUMN assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE;

-- ---- test_attempts ----
ALTER TABLE test_attempts DROP CONSTRAINT IF EXISTS test_attempts_pkey CASCADE;
ALTER TABLE test_attempts DROP CONSTRAINT IF EXISTS test_attempts_candidate_id_fkey;
ALTER TABLE test_attempts DROP CONSTRAINT IF EXISTS test_attempts_assessment_id_fkey;
ALTER TABLE test_attempts DROP COLUMN id;
ALTER TABLE test_attempts ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE test_attempts DROP COLUMN candidate_id;
ALTER TABLE test_attempts DROP COLUMN assessment_id;
ALTER TABLE test_attempts ADD COLUMN candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE test_attempts ADD COLUMN assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE;

-- ---- responses ----
ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_pkey CASCADE;
ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_candidate_id_fkey;
ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_question_id_fkey;
ALTER TABLE responses DROP COLUMN id;
ALTER TABLE responses ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE responses DROP COLUMN candidate_id;
ALTER TABLE responses DROP COLUMN question_id;
ALTER TABLE responses ADD COLUMN candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE responses ADD COLUMN question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE;

-- ---- results ----
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_pkey CASCADE;
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_candidate_id_fkey;
ALTER TABLE results DROP COLUMN id;
ALTER TABLE results ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE results DROP COLUMN candidate_id;
ALTER TABLE results ADD COLUMN candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE UNIQUE;

-- ---- proctoring_sessions ----
ALTER TABLE proctoring_sessions DROP CONSTRAINT IF EXISTS proctoring_sessions_pkey CASCADE;
ALTER TABLE proctoring_sessions DROP CONSTRAINT IF EXISTS proctoring_sessions_attempt_id_fkey;
ALTER TABLE proctoring_sessions DROP COLUMN id;
ALTER TABLE proctoring_sessions ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE proctoring_sessions DROP COLUMN attempt_id;
ALTER TABLE proctoring_sessions ADD COLUMN attempt_id BIGINT REFERENCES test_attempts(id) ON DELETE CASCADE;

-- ---- proctoring_logs ----
ALTER TABLE proctoring_logs DROP CONSTRAINT IF EXISTS proctoring_logs_pkey CASCADE;
ALTER TABLE proctoring_logs DROP CONSTRAINT IF EXISTS proctoring_logs_session_id_fkey;
ALTER TABLE proctoring_logs DROP COLUMN id;
ALTER TABLE proctoring_logs ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE proctoring_logs DROP COLUMN session_id;
ALTER TABLE proctoring_logs ADD COLUMN session_id BIGINT REFERENCES proctoring_sessions(id) ON DELETE CASCADE;

-- ---- test_violations ----
ALTER TABLE test_violations DROP CONSTRAINT IF EXISTS test_violations_pkey CASCADE;
ALTER TABLE test_violations DROP CONSTRAINT IF EXISTS test_violations_candidate_id_fkey;
ALTER TABLE test_violations DROP CONSTRAINT IF EXISTS test_violations_assessment_id_fkey;
ALTER TABLE test_violations DROP COLUMN id;
ALTER TABLE test_violations ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE test_violations DROP COLUMN candidate_id;
ALTER TABLE test_violations DROP COLUMN assessment_id;
ALTER TABLE test_violations ADD COLUMN candidate_id BIGINT REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE test_violations ADD COLUMN assessment_id BIGINT REFERENCES assessments(id) ON DELETE CASCADE;

-- ---- audit_logs ----
-- audit_logs.actor_id references users.id (TEXT) — keep as TEXT
-- audit_logs.target_id was UUID, change to TEXT to hold any kind of ID (integer or string)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey CASCADE;
ALTER TABLE audit_logs DROP COLUMN id;
ALTER TABLE audit_logs ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE audit_logs ALTER COLUMN target_id TYPE TEXT USING target_id::TEXT;

-- ---- manager_assignments ----
ALTER TABLE manager_assignments DROP CONSTRAINT IF EXISTS manager_assignments_pkey CASCADE;
ALTER TABLE manager_assignments DROP COLUMN id;
ALTER TABLE manager_assignments ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- ============================================================
-- STEP 3: Re-seed system permissions
-- ============================================================
INSERT INTO permissions (code, description) VALUES
    ('assign_hierarchy',              'Can assign recruiters to managers'),
    ('assign_roles',                  'Can assign roles to users'),
    ('bulk_delete_assessments',       'Can perform mass-deletion of assessment records'),
    ('create_assessments',            'Can create new assessments'),
    ('create_questions',              'Can create new questions'),
    ('delete_assessments',            'Can delete assessments'),
    ('delete_questions',              'Can delete questions'),
    ('edit_assessment_instructions',  'Can update custom instructions shown to candidates'),
    ('edit_assessment_scheduling',    'Can modify assessment timers, activation windows, and expiration dates'),
    ('edit_assessment_security',      'Can configure anti-cheating, dev-mode detection, and browser lockdown'),
    ('edit_questions',                'Can edit existing questions'),
    ('invite_users',                  'Can invite new users to the platform'),
    ('manage_candidates',             'Can manage candidates and invites'),
    ('manage_roles',                  'Can create and assign roles'),
    ('manage_settings',               'Can manage tenant-level settings'),
    ('publish_assessment',            'Can publish/activate assessments'),
    ('view_questions',                'Can view question bank'),
    ('view_reports',                  'Can view assessment reports')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- STEP 4: Re-seed system roles (global — tenant_id NULL)
-- ============================================================
INSERT INTO roles (name, tenant_id, is_system_role, description) VALUES
    ('SUPER_ADMIN',  NULL, true, 'Full platform access across all tenants'),
    ('ADMIN',        NULL, true, 'Full access within a tenant'),
    ('MANAGER',      NULL, true, 'Can manage recruiters and view all their assessments'),
    ('RECRUITER',    NULL, true, 'Can create assessments and manage candidates'),
    ('COLLABORATOR', NULL, true, 'Read-only collaborator access')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 5: Re-seed role_permissions
-- ============================================================
DO $$
DECLARE
    v_super_admin_id  BIGINT;
    v_admin_id        BIGINT;
    v_manager_id      BIGINT;
    v_recruiter_id    BIGINT;
    v_collab_id       BIGINT;
BEGIN
    SELECT id INTO v_super_admin_id  FROM roles WHERE name = 'SUPER_ADMIN'  AND tenant_id IS NULL;
    SELECT id INTO v_admin_id        FROM roles WHERE name = 'ADMIN'         AND tenant_id IS NULL;
    SELECT id INTO v_manager_id      FROM roles WHERE name = 'MANAGER'       AND tenant_id IS NULL;
    SELECT id INTO v_recruiter_id    FROM roles WHERE name = 'RECRUITER'     AND tenant_id IS NULL;
    SELECT id INTO v_collab_id       FROM roles WHERE name = 'COLLABORATOR'  AND tenant_id IS NULL;

    -- SUPER_ADMIN: all permissions
    INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_super_admin_id, id FROM permissions
        ON CONFLICT DO NOTHING;

    -- ADMIN: all except edit_assessment_* (scheduling/security/instructions handled at field level)
    INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_admin_id, id FROM permissions
        WHERE code IN (
            'assign_hierarchy','assign_roles','bulk_delete_assessments',
            'create_assessments','create_questions','delete_assessments',
            'delete_questions','edit_questions','invite_users',
            'manage_candidates','manage_roles','publish_assessment',
            'view_questions','view_reports'
        )
        ON CONFLICT DO NOTHING;

    -- MANAGER
    INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_manager_id, id FROM permissions
        WHERE code IN (
            'assign_hierarchy','create_assessments','manage_candidates',
            'view_questions','view_reports'
        )
        ON CONFLICT DO NOTHING;

    -- RECRUITER
    INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_recruiter_id, id FROM permissions
        WHERE code IN (
            'create_assessments','create_questions','delete_assessments',
            'delete_questions','edit_questions','manage_candidates',
            'view_questions','view_reports'
        )
        ON CONFLICT DO NOTHING;

    -- COLLABORATOR
    INSERT INTO role_permissions (role_id, permission_id)
        SELECT v_collab_id, id FROM permissions
        WHERE code IN ('create_assessments','view_questions','view_reports')
        ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- STEP 6: Recreate performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_questions_domain      ON questions(domain_id);
CREATE INDEX IF NOT EXISTS idx_assessments_share_token ON assessments(share_token);
CREATE INDEX IF NOT EXISTS idx_candidates_assessment  ON candidates(assessment_id);
CREATE INDEX IF NOT EXISTS idx_candidates_share_token ON candidates(share_token);
CREATE INDEX IF NOT EXISTS idx_responses_candidate    ON responses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_responses_question     ON responses(question_id);
CREATE INDEX IF NOT EXISTS idx_results_candidate      ON results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment ON assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_question   ON assessment_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role  ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_tenant           ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor       ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_manager   ON manager_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_recruiter ON manager_assignments(recruiter_id);
