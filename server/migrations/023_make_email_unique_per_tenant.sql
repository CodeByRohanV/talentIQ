-- Migration 023: Make users email unique per tenant instead of globally unique
DO $$
BEGIN
    -- Drop the existing users_email_key unique constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_email_key;
    END IF;

    -- Add the new unique constraint (email, tenant_id)
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'users_email_tenant_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_tenant_unique UNIQUE (email, tenant_id);
    END IF;
END $$;
