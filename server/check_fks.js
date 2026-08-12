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
    const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE contype = 'f' AND pg_get_constraintdef(c.oid) LIKE '%users(id)%';
    `);
    console.log('Foreign Keys referencing users(id):', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
