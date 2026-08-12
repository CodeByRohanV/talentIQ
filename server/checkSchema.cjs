const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:rohan321@localhost:5432/xeskillz' });
client.connect()
  .then(() => Promise.all(['test_attempts', 'results', 'candidates'].map(table => client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`))))
  .then(res => res.forEach((r, i) => { console.log(`\nTable ${i}:`); console.table(r.rows); }))
  .catch(console.error)
  .finally(() => client.end());
