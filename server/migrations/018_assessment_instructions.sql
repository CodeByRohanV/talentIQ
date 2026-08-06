-- Add custom instructions to assessments
ALTER TABLE assessments ADD COLUMN instructions TEXT DEFAULT NULL;
