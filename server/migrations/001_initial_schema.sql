-- Enable pgcrypto extension for gen_random_bytes and gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create ENUM type for question domains only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_domain') THEN
        CREATE TYPE question_domain AS ENUM ('behavioral', 'arithmetic', 'logical_reasoning', 'quantitative_aptitude');
    END IF;
END$$;

-- Users table (replaces Supabase auth.users + profiles)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  company_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  domain question_domain NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL,
  difficulty VARCHAR(50) DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  questions_config JSONB DEFAULT '{"behavioral": 10, "arithmetic": 10, "logical_reasoning": 10, "quantitative_aptitude": 10}',
  thresholds JSONB DEFAULT '{"overall": 60, "behavioral": 50, "arithmetic": 50, "logical_reasoning": 50, "quantitative_aptitude": 50}',
  share_token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  share_token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Responses table
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  selected_answer INTEGER,
  is_flagged BOOLEAN DEFAULT false,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Results table
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE NOT NULL UNIQUE,
  overall_score DECIMAL(5,2) DEFAULT 0,
  domain_scores JSONB DEFAULT '{}',
  passed BOOLEAN DEFAULT false,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessment Questions junction table
CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  question_order INTEGER DEFAULT 0,
  UNIQUE(assessment_id, question_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_questions_recruiter ON questions(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_questions_domain ON questions(domain);
CREATE INDEX IF NOT EXISTS idx_assessments_recruiter ON assessments(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_assessments_share_token ON assessments(share_token);
CREATE INDEX IF NOT EXISTS idx_candidates_assessment ON candidates(assessment_id);
CREATE INDEX IF NOT EXISTS idx_candidates_share_token ON candidates(share_token);
CREATE INDEX IF NOT EXISTS idx_responses_candidate ON responses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id);
CREATE INDEX IF NOT EXISTS idx_results_candidate ON results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment ON assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_question ON assessment_questions(question_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assessments_updated_at ON assessments;
CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
