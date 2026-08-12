-- Migration 014: Manager-Recruiter Scoping
-- Implements direct manager linkage and scoped visibility

-- 1. Update Users Table with Manager Hierarchy
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Update Questions Table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by_manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Update Assessments Table
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS created_by_manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 4. Backfill data from existing manager_assignments
UPDATE users u
SET manager_id = ma.manager_id
FROM manager_assignments ma
WHERE u.id = ma.recruiter_id;

-- 5. Backfill questions created_by_manager_id
-- If created by a manager, manager_id is themselves.
-- If created by a recruiter, use their assigned manager.
UPDATE questions q
SET created_by_manager_id = (
    CASE 
        WHEN u.manager_id IS NOT NULL THEN u.manager_id
        ELSE q.created_by
    END
)
FROM users u
WHERE q.created_by = u.id;

-- 6. Backfill assessments created_by_manager_id
UPDATE assessments a
SET created_by_manager_id = (
    CASE 
        WHEN u.manager_id IS NOT NULL THEN u.manager_id
        ELSE a.created_by
    END
)
FROM users u
WHERE a.created_by = u.id;

-- 7. Add Indexes for scoped queries
CREATE INDEX IF NOT EXISTS idx_questions_manager_id ON questions(created_by_manager_id);
CREATE INDEX IF NOT EXISTS idx_assessments_manager_id ON assessments(created_by_manager_id);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);
