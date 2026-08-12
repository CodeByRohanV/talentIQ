CREATE TABLE IF NOT EXISTS proctoring_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES test_attempts(id) ON DELETE CASCADE,
    tenant_id UUID,
    status VARCHAR(50) DEFAULT 'active',
    recording_url TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS proctoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    tenant_id UUID,
    event_type VARCHAR(100) NOT NULL,
    description TEXT,
    screenshot_url TEXT,
    video_clip_url TEXT,
    risk_level VARCHAR(20) DEFAULT 'low',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt ON proctoring_sessions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_session ON proctoring_logs(session_id);
