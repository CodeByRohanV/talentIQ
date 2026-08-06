-- Add availability fields to assessments
ALTER TABLE assessments
ADD COLUMN available_from TIMESTAMP WITH TIME ZONE,
ADD COLUMN available_until TIMESTAMP WITH TIME ZONE;

-- Update existing records to have no specific availability (null means always available)
-- though expires_at might have been used before.
-- We'll keep expires_at for backward compatibility but prioritize available_until if set.
