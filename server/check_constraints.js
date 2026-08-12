import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'xeskillz', password: 'rohan321', port: 5432 });

pool.query(`
SELECT 
    tc.constraint_name, 
    tc.constraint_type, 
    kcu.column_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'user_roles';
`)
  .then(r => console.log('Constraints:', r.rows))
  .catch(console.error)
  .finally(() => pool.end());
