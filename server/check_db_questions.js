import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'xeskillz',
  password: 'rohan321',
  port: 5432,
});

async function run() {
  try {
    const res = await pool.query(`SELECT COUNT(*) FROM questions`);
    console.log('Total questions in DB:', res.rows[0].count);

    const resShruthi = await pool.query(`SELECT COUNT(*) FROM questions WHERE created_by = 'ee83bd86-45dc-4f0d-8d83-ce967ac76789'`);
    console.log('Questions by Shruthi:', resShruthi.rows[0].count);

    const sample = await pool.query(`SELECT id, question_text, created_by, domain_id, domain, created_by_manager_id FROM questions WHERE created_by = 'ee83bd86-45dc-4f0d-8d83-ce967ac76789' LIMIT 1`);
    console.log('Sample question by Shruthi:', sample.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
