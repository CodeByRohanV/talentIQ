-- Create profiles table for recruiters
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create domain enum for question types
CREATE TYPE public.question_domain AS ENUM ('behavioral', 'arithmetic', 'logical_reasoning', 'quantitative_aptitude');

-- Create questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  domain question_domain NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  questions_config JSONB NOT NULL DEFAULT '{"behavioral": 10, "arithmetic": 10, "logical_reasoning": 10, "quantitative_aptitude": 10}',
  thresholds JSONB NOT NULL DEFAULT '{"overall": 60, "behavioral": 50, "arithmetic": 50, "logical_reasoning": 50, "quantitative_aptitude": 50}',
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create candidates table
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create responses table
CREATE TABLE public.responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  selected_answer INTEGER,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create results table
CREATE TABLE public.results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL UNIQUE,
  overall_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  domain_scores JSONB NOT NULL DEFAULT '{}',
  passed BOOLEAN NOT NULL DEFAULT false,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assessment_questions junction table for tracking which questions are in which assessment
CREATE TABLE public.assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  question_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(assessment_id, question_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user owns an assessment
CREATE OR REPLACE FUNCTION public.is_assessment_owner(assessment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessments
    WHERE id = assessment_id AND recruiter_id = auth.uid()
  )
$$;

-- Helper function to get recruiter_id from assessment_id
CREATE OR REPLACE FUNCTION public.get_assessment_recruiter(assessment_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT recruiter_id FROM public.assessments WHERE id = assessment_id
$$;

-- Helper function to get assessment_id from candidate_id
CREATE OR REPLACE FUNCTION public.get_candidate_assessment(candidate_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assessment_id FROM public.candidates WHERE id = candidate_id
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Questions RLS policies
CREATE POLICY "Recruiters can view their own questions"
  ON public.questions FOR SELECT
  USING (recruiter_id = auth.uid());

CREATE POLICY "Recruiters can insert their own questions"
  ON public.questions FOR INSERT
  WITH CHECK (recruiter_id = auth.uid());

CREATE POLICY "Recruiters can update their own questions"
  ON public.questions FOR UPDATE
  USING (recruiter_id = auth.uid());

CREATE POLICY "Recruiters can delete their own questions"
  ON public.questions FOR DELETE
  USING (recruiter_id = auth.uid());

-- Assessments RLS policies
CREATE POLICY "Recruiters can view their own assessments"
  ON public.assessments FOR SELECT
  USING (recruiter_id = auth.uid());

CREATE POLICY "Recruiters can insert their own assessments"
  ON public.assessments FOR INSERT
  WITH CHECK (recruiter_id = auth.uid());

CREATE POLICY "Recruiters can update their own assessments"
  ON public.assessments FOR UPDATE
  USING (recruiter_id = auth.uid());

CREATE POLICY "Recruiters can delete their own assessments"
  ON public.assessments FOR DELETE
  USING (recruiter_id = auth.uid());

-- Public access to assessments via share token (for candidates)
CREATE POLICY "Public can view assessments by share token"
  ON public.assessments FOR SELECT
  USING (is_active = true);

-- Candidates RLS policies
CREATE POLICY "Recruiters can view candidates for their assessments"
  ON public.candidates FOR SELECT
  USING (public.is_assessment_owner(assessment_id));

CREATE POLICY "Public can insert candidates for active assessments"
  ON public.candidates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE id = assessment_id AND is_active = true
    )
  );

CREATE POLICY "Public can view their own candidate record by share token"
  ON public.candidates FOR SELECT
  USING (true);

CREATE POLICY "Candidates can update their own record"
  ON public.candidates FOR UPDATE
  USING (true);

-- Responses RLS policies
CREATE POLICY "Recruiters can view responses for their assessments"
  ON public.responses FOR SELECT
  USING (
    public.is_assessment_owner(public.get_candidate_assessment(candidate_id))
  );

CREATE POLICY "Candidates can insert their own responses"
  ON public.responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Candidates can update their own responses"
  ON public.responses FOR UPDATE
  USING (true);

-- Results RLS policies
CREATE POLICY "Recruiters can view results for their assessments"
  ON public.results FOR SELECT
  USING (
    public.is_assessment_owner(public.get_candidate_assessment(candidate_id))
  );

CREATE POLICY "System can insert results"
  ON public.results FOR INSERT
  WITH CHECK (true);

-- Assessment Questions RLS policies
CREATE POLICY "Recruiters can view their assessment questions"
  ON public.assessment_questions FOR SELECT
  USING (public.is_assessment_owner(assessment_id));

CREATE POLICY "Recruiters can manage their assessment questions"
  ON public.assessment_questions FOR INSERT
  WITH CHECK (public.is_assessment_owner(assessment_id));

CREATE POLICY "Recruiters can delete their assessment questions"
  ON public.assessment_questions FOR DELETE
  USING (public.is_assessment_owner(assessment_id));

CREATE POLICY "Public can view assessment questions for active assessments"
  ON public.assessment_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE id = assessment_id AND is_active = true
    )
  );

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_questions_recruiter ON public.questions(recruiter_id);
CREATE INDEX idx_questions_domain ON public.questions(domain);
CREATE INDEX idx_assessments_recruiter ON public.assessments(recruiter_id);
CREATE INDEX idx_assessments_share_token ON public.assessments(share_token);
CREATE INDEX idx_candidates_assessment ON public.candidates(assessment_id);
CREATE INDEX idx_candidates_share_token ON public.candidates(share_token);
CREATE INDEX idx_responses_candidate ON public.responses(candidate_id);
CREATE INDEX idx_results_candidate ON public.results(candidate_id);