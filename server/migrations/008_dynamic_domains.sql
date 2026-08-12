-- Create domains table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    recruiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(slug, recruiter_id)
);

-- Add domain_id to questions FIRST before any updates
DO $$
BEGIN
    -- 1. Add domain_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'domain_id') THEN
        ALTER TABLE questions ADD COLUMN domain_id UUID REFERENCES domains(id) ON DELETE SET NULL;
    END IF;

    -- 2. Make legacy domain column nullable to support custom domains
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'domain' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE questions ALTER COLUMN domain DROP NOT NULL;
    END IF;

    -- 3. Change ENUM type to VARCHAR if not already converted
    -- This allows custom domain slugs (like 'sa') which are not in the hardcoded ENUM
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'domain' AND udt_name = 'question_domain'
    ) THEN
        ALTER TABLE questions ALTER COLUMN domain TYPE VARCHAR(255) USING domain::TEXT;
    END IF;
END $$;

-- Seed domains from existing questions
DO $$
DECLARE
    q_row RECORD;
    new_domain_id UUID;
BEGIN
    -- 1. Seed global standard domains if they don't exist
    INSERT INTO domains (name, slug, recruiter_id)
    SELECT 'Behavioral', 'behavioral', NULL WHERE NOT EXISTS (SELECT 1 FROM domains WHERE slug = 'behavioral' AND recruiter_id IS NULL);
    
    INSERT INTO domains (name, slug, recruiter_id)
    SELECT 'Arithmetic', 'arithmetic', NULL WHERE NOT EXISTS (SELECT 1 FROM domains WHERE slug = 'arithmetic' AND recruiter_id IS NULL);
    
    INSERT INTO domains (name, slug, recruiter_id)
    SELECT 'Logical Reasoning', 'logical_reasoning', NULL WHERE NOT EXISTS (SELECT 1 FROM domains WHERE slug = 'logical_reasoning' AND recruiter_id IS NULL);
    
    INSERT INTO domains (name, slug, recruiter_id)
    SELECT 'Quantitative Aptitude', 'quantitative_aptitude', NULL WHERE NOT EXISTS (SELECT 1 FROM domains WHERE slug = 'quantitative_aptitude' AND recruiter_id IS NULL);

    -- 2. Seed domains from existing questions (for custom ones used previously)
    -- BUT only if they don't already exist as global domains
    FOR q_row IN SELECT DISTINCT domain::TEXT AS domain, recruiter_id FROM questions LOOP
        -- Skip if it matches a global domain slug
        IF NOT EXISTS (SELECT 1 FROM domains WHERE slug = q_row.domain AND recruiter_id IS NULL) THEN
            -- Only insert if it doesn't exist for this recruiter
            IF NOT EXISTS (SELECT 1 FROM domains WHERE slug = q_row.domain AND recruiter_id = q_row.recruiter_id) THEN
                INSERT INTO domains (name, slug, recruiter_id) 
                VALUES (INITCAP(REPLACE(q_row.domain, '_', ' ')), q_row.domain, q_row.recruiter_id)
                RETURNING id INTO new_domain_id;
            ELSE
                SELECT id INTO new_domain_id FROM domains WHERE slug = q_row.domain AND recruiter_id = q_row.recruiter_id;
            END IF;
        ELSE
            -- Map to the global domain if it exists
            SELECT id INTO new_domain_id FROM domains WHERE slug = q_row.domain AND recruiter_id IS NULL;
        END IF;
        
        -- Update the question with the found/created domain_id
        UPDATE questions SET domain_id = new_domain_id WHERE recruiter_id = q_row.recruiter_id AND domain::TEXT = q_row.domain;
    END LOOP;
END $$;

-- Link existing questions to new domains based on slug and recruiter_id
-- We use ::TEXT cast because domain column is an ENUM but slug is VARCHAR
UPDATE questions q
SET domain_id = d.id
FROM domains d
WHERE q.domain::TEXT = d.slug AND q.recruiter_id = d.recruiter_id
AND q.domain_id IS NULL;