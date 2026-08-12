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
    const tenantId = 'ee83bd86-45dc-4f0d-8d83-ce967ac76789';
    const managerId = 'ee83bd86-45dc-4f0d-8d83-ce967ac76789';

    const res = await pool.query(`
        SELECT q.*, COALESCE(d.name, INITCAP(REPLACE(q.domain::TEXT, '_', ' '))) as domain_name 
        FROM questions q
        LEFT JOIN domains d ON q.domain_id = d.id
        WHERE (split_part(q.created_by::text, '_', 1) = $1 OR q.created_by IS NULL)
        AND q.is_deleted = false
        AND (q.created_by_manager_id = $2 OR q.created_by IS NULL)
    `, [tenantId, managerId]);

    console.log('Total returned:', res.rows.length);

    // Now test with exactly the values from the dashboard controller!
    const dashRes = await pool.query(`
            SELECT 
                COUNT(*) as total_questions,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_questions
            FROM questions
            WHERE (split_part(created_by::text, '_', 1) = $1 OR created_by IS NULL)
            AND (created_by_manager_id = $2 OR created_by IS NULL)
            AND is_deleted = false
    `, [tenantId, managerId]);
    console.log('Dashboard stats:', dashRes.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
