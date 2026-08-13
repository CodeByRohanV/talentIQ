import { query } from './src/config/database.js';

async function main() {
  const res = await query(`
    SELECT pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'assessments'::regclass
  `);
  console.log(res.rows);
}

main().catch(console.error).then(() => process.exit(0));
