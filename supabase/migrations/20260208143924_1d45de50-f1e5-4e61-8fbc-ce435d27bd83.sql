-- Add SELECT policy on responses so candidates can read back their own responses during scoring
CREATE POLICY "Candidates can view their own responses"
ON public.responses
FOR SELECT
USING (true);