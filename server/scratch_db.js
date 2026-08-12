import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'xeskillz', password: 'rohan321', port: 5432 });
pool.query("SELECT title, created_by, created_by_manager_id FROM assessments WHERE title = 'test after deletion'")
  .then(r => console.log('Assessments:', r.rows))
  .catch(console.error)
  .finally(() => pool.end());
