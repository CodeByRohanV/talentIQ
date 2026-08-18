import * as Result from './src/models/Result.js';
import { query } from './src/config/database.js';

async function test() {
    try {
        const assessmentQuery = await query('SELECT id FROM assessments LIMIT 1');
        const id = assessmentQuery.rows[0].id;
        const results = await Result.findResultsByAssessmentIds([id]);
        console.log("Candidate sample:", results[0] || "No candidates");
        
        const responses = await Result.findAllDetailedResponsesByAssessmentId(id);
        console.log("Response sample:", responses[0] || "No responses");
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
