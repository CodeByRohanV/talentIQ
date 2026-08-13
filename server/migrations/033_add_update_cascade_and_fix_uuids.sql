-- Migration: 033_add_update_cascade_and_fix_uuids
-- Description: Adds ON UPDATE CASCADE to all user foreign keys to properly support ID corrections, and fixes existing UUID users to use their employee_id.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Create a temporary table to hold all foreign keys referencing users(id)
    CREATE TEMP TABLE temp_user_fks ON COMMIT DROP AS
    SELECT
        tc.table_name::text,
        kcu.column_name::text,
        tc.constraint_name::text,
        tc.table_schema::text,
        rc.update_rule::text,
        rc.delete_rule::text
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id';

    -- 2. Loop through and dynamically DROP all found constraints
    FOR r IN SELECT * FROM temp_user_fks LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;', r.table_schema, r.table_name, r.constraint_name);
    END LOOP;

    -- Drop any known legacy constraints that might have been renamed and missed by the query
    ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_recruiter_id_fkey;
    ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_recruiter_id_fkey;
    ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_recruiter_id_fkey;
    ALTER TABLE manager_assignments DROP CONSTRAINT IF EXISTS manager_assignments_recruiter_id_fkey;

    -- 3. Loop through and ALTER all referencing columns to VARCHAR(255)
    FOR r IN SELECT DISTINCT table_schema, table_name, column_name FROM temp_user_fks LOOP
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE VARCHAR(255) USING %I::VARCHAR;', r.table_schema, r.table_name, r.column_name, r.column_name);
    END LOOP;

    -- Ensure any explicitly known columns are altered just in case they were missed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_id') THEN
        ALTER TABLE audit_logs ALTER COLUMN actor_id TYPE VARCHAR(255) USING actor_id::VARCHAR;
    END IF;

    -- 4. Alter the primary key column on users
    ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(255) USING id::VARCHAR;

    -- 5. Loop through and Re-ADD all constraints with ON UPDATE CASCADE
    FOR r IN SELECT * FROM temp_user_fks LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE %s ON UPDATE CASCADE;', 
            r.table_schema, r.table_name, r.constraint_name, r.column_name, r.delete_rule
        );
    END LOOP;
END$$;

-- 6. Automatically fix any existing users whose ID is a UUID
UPDATE users 
SET id = employee_id 
WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
AND employee_id LIKE '%_%';
