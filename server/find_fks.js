import db from './src/config/database.js';

async function getFKs() {
  const result = await db.query(`
    SELECT
        tc.table_name::text,
        kcu.column_name::text,
        tc.constraint_name::text,
        tc.table_schema::text,
        rc.update_rule::text,
        rc.delete_rule::text
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
  `);
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
}

getFKs();
