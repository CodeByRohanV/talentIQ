import 'dotenv/config';
import { query } from './src/config/database.js';

import { findAssessmentById } from './src/models/Assessment.js';

async function run() {
    try {
        const updateResult = await query(`
            UPDATE results r
            SET passed = (r.overall_score >= COALESCE((a.thresholds->>'overall')::numeric, 60))
            FROM candidates c
            JOIN assessments a ON c.assessment_id = a.id
            WHERE r.candidate_id = c.id
            RETURNING r.candidate_id, r.overall_score, r.passed;
        `);
        console.log('Fixed historical results:', updateResult.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
