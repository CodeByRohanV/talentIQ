DO $$
DECLARE
    assessment_id_type text;
BEGIN
    -- Get the type of assessments.id to handle schema desyncs (UUID vs BIGINT)
    SELECT data_type INTO assessment_id_type
    FROM information_schema.columns
    WHERE table_name = 'assessments' AND column_name = 'id';

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS candidate_otps (
            id SERIAL PRIMARY KEY,
            assessment_id %s REFERENCES assessments(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            otp VARCHAR(6) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ', assessment_id_type);
END $$;
