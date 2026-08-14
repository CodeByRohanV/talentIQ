-- Migration 036: Scenario-Based Subjective Questions Support

-- Add question_type to questions
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) DEFAULT 'MULTIPLE_CHOICE';

-- Add subjective grading fields to responses
ALTER TABLE responses 
ADD COLUMN IF NOT EXISTS text_answer TEXT,
ADD COLUMN IF NOT EXISTS manual_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS grader_feedback TEXT;
