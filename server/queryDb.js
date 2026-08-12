import pg from 'pg';
const { Client } = pg;
const client = new Client({
  user: 'postgres',
  password: 'rohan321',
  host: '127.0.0.1',
  port: 5432,
  database: 'scaloz_super_admin'
});
async function run() {
  try {
    await client.connect();
    // Update tenant 1
    await client.query(`
      UPDATE tenants 
      SET selected_products = 'INTERVIEW:Active,876:Active,HRMS:Active,SKILLZ:Active'
      WHERE id = '1'
    `);
    console.log("Updated tenant 1 to include SKILLZ");
    
    // Update tenant 2 as well just in case
    await client.query(`
      UPDATE tenants 
      SET selected_products = 'INTERVIEW:Active,876:Active,HRMS:Active,SKILLZ:Active'
      WHERE id = '2'
    `);
    console.log("Updated tenant 2 to include SKILLZ");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
