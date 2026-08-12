import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'rohan321',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'xeskillz'
});

async function run() {
  try {
    await client.connect();
    
    // Fetch the latest 5 test attempts
    const result = await client.query(`
      SELECT id, candidate_id, attempt_status, ip_address, created_at 
      FROM test_attempts 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log("=== Latest Test Attempts ===");
    if (result.rows.length === 0) {
      console.log("No test attempts found.");
    } else {
      console.table(result.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
