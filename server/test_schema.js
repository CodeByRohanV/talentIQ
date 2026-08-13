import { query } from './src/config/database.js';

async function main() {
  const res = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'assessments'
  `);
  console.log(res.rows);
}

main().catch(console.error).then(() => process.exit(0));
