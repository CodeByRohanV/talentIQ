
-- Fix: Change public-facing SELECT policies from RESTRICTIVE to PERMISSIVE
-- so that candidates (unauthenticated users) can access assessments via share_token

-- 1. Fix assessments: drop restrictive public policy and recreate as permissive
DROP POLICY IF EXISTS "Public can view assessments by share token" ON public.assessments;
CREATE POLICY "Public can view active assessments"
  ON public.assessments FOR SELECT
  USING (is_active = true);

-- 2. Fix assessment_questions: drop restrictive public policy and recreate as permissive
DROP POLICY IF EXISTS "Public can view assessment questions for active assessments" ON public.assessment_questions;
CREATE POLICY "Public can view assessment questions for active assessments"
  ON public.assessment_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM assessments
    WHERE assessments.id = assessment_questions.assessment_id
      AND assessments.is_active = true
  ));

-- 3. Add public SELECT policy for questions table so candidates can read questions during test
CREATE POLICY "Public can view questions for active assessments"
  ON public.questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM assessment_questions aq
    JOIN assessments a ON a.id = aq.assessment_id
    WHERE aq.question_id = questions.id
      AND a.is_active = true
  ));
