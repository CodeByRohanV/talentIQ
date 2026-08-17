import { query } from './src/config/database.js';

async function test() {
    try {
        const res = await query(`
            SELECT id, question_text, options, correct_answer 
            FROM questions 
            ORDER BY id DESC
            LIMIT 20
        `);
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
test();
