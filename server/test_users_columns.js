import { query } from './src/config/database.js';

async function main() {
  const res = await query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users'
  `);
  console.log(res.rows);
}

main().catch(console.error).then(() => process.exit(0));
