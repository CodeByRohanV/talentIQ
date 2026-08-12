-- Migration: Add password reset fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expiry TIMESTAMP WITH TIME ZONE;
