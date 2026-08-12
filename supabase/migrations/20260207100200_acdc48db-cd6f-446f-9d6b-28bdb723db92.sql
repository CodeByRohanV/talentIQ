
-- Drop existing foreign keys and recreate with CASCADE delete
-- This ensures deleting questions automatically cleans up responses and assessment_questions

-- 1. responses.question_id -> questions.id (CASCADE)
ALTER TABLE public.responses
  DROP CONSTRAINT IF EXISTS responses_question_id_fkey;

ALTER TABLE public.responses
  ADD CONSTRAINT responses_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.questions(id)
  ON DELETE CASCADE;

-- 2. assessment_questions.question_id -> questions.id (CASCADE)
ALTER TABLE public.assessment_questions
  DROP CONSTRAINT IF EXISTS assessment_questions_question_id_fkey;

ALTER TABLE public.assessment_questions
  ADD CONSTRAINT assessment_questions_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.questions(id)
  ON DELETE CASCADE;
