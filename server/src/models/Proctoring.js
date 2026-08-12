import { query } from '../config/database.js';

class Proctoring {
    static async createSession(attemptId, tenantId) {
        const sql = `
            INSERT INTO proctoring_sessions (attempt_id, tenant_id)
            VALUES ($1, $2)
            RETURNING *
        `;
        const result = await query(sql, [attemptId, tenantId]);
        return result.rows[0];
    }

    static async endSession(sessionId) {
        const sql = `
            UPDATE proctoring_sessions
            SET status = 'completed', ended_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
        const result = await query(sql, [sessionId]);
        return result.rows[0];
    }

    static async logEvent(sessionId, tenantId, eventType, description, screenshotUrl, riskLevel) {
        const sql = `
            INSERT INTO proctoring_logs (session_id, tenant_id, event_type, description, screenshot_url, risk_level)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const result = await query(sql, [sessionId, tenantId, eventType, description, screenshotUrl, riskLevel]);
        return result.rows[0];
    }

    static async getReportByCandidateId(candidateId) {
        // Get the session via attempt's candidate_id
        const sessionSql = `
            SELECT ps.* 
            FROM proctoring_sessions ps
            JOIN test_attempts ta ON ps.attempt_id = ta.id
            WHERE ta.candidate_id = $1
            ORDER BY ps.started_at DESC LIMIT 1
        `;
        const sessionResult = await query(sessionSql, [candidateId]);
        
        if (sessionResult.rows.length === 0) return null;
        const session = sessionResult.rows[0];

        // Get the logs
        const logsSql = `SELECT * FROM proctoring_logs WHERE session_id = $1 ORDER BY timestamp ASC`;
        const logsResult = await query(logsSql, [session.id]);

        return {
            session,
            logs: logsResult.rows
        };
    }
}

export default Proctoring;
