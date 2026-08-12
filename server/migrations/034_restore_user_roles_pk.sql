-- Migration: 034_restore_user_roles_pk
-- Description: Clean up duplicate user_roles entries and restore UNIQUE constraint lost during UUID to Serial migration

-- 1. Delete duplicate user_roles
WITH duplicates AS (
    SELECT ctid,
           ROW_NUMBER() OVER(
               PARTITION BY user_id, role_id
               ORDER BY assigned_at ASC
           ) as row_num
    FROM user_roles
)
DELETE FROM user_roles
WHERE ctid IN (
    SELECT ctid
    FROM duplicates
    WHERE row_num > 1
);

-- 2. Restore primary key / unique constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_id_key;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);
