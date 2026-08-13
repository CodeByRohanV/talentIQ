import { query } from './src/config/database.js';

async function main() {
  try {
    const res = await query(
      `UPDATE assessments SET created_by = 'rohan_EMP001' WHERE created_by IS NULL`
    );
    console.log('Updated rows:', res.rowCount);
  } catch (err) {
    console.error('Failed!', err);
  }
}

main().catch(console.error).then(() => process.exit(0));
