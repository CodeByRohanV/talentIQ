-- Add video proctoring toggle to assessments table
ALTER TABLE assessments
ADD COLUMN IF NOT EXISTS video_proctoring_enabled BOOLEAN DEFAULT false;

-- Update existing assessments to have video proctoring disabled by default
UPDATE assessments SET video_proctoring_enabled = false WHERE video_proctoring_enabled IS NULL;
