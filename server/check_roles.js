import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'xeskillz', password: 'rohan321', port: 5432 });
pool.query("SELECT * FROM user_roles WHERE user_id = 'rohan_01014'")
  .then(r => console.log('Roles:', r.rows))
  .catch(console.error)
  .finally(() => pool.end());
