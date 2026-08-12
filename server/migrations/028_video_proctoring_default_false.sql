-- Alter video_proctoring_enabled default to false and update existing records
ALTER TABLE assessments ALTER COLUMN video_proctoring_enabled SET DEFAULT false;
UPDATE assessments SET video_proctoring_enabled = false;
