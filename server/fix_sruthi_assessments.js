import { query } from './src/config/database.js';

async function main() {
  try {
    const res = await query(
      `UPDATE assessments SET created_by = 'rohan_01014' WHERE title IN ('test 1', 'test - not refecting', 'test after deletion', 'new test ')`
    );
    console.log('Updated rows to Sruthi:', res.rowCount);
  } catch (err) {
    console.error('Failed!', err);
  }
}

main().catch(console.error).then(() => process.exit(0));
