import 'dotenv/config';
import { query } from './src/config/database.js';

async function run() {
    try {
        const candidateId = '28';
        const candidateQuery = await query(`SELECT assessment_id FROM candidates WHERE id = $1`, [candidateId]);
        const assessmentId = candidateQuery.rows[0].assessment_id;
        console.log('Assessment ID:', assessmentId);

        const maxScoreQuery = await query(`
            SELECT SUM(COALESCE(q.max_score, 1)) as total_max_score
            FROM assessment_questions aq
            JOIN questions q ON aq.question_id = q.id
            WHERE aq.assessment_id = $1
        `, [assessmentId]);
        console.log('Max Score Query Rows:', maxScoreQuery.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
