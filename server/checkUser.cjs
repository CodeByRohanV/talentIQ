const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:rohan321@localhost:5432/xeskillz' });
client.connect()
  .then(() => client.query("SELECT * FROM users WHERE email = 'rohanvjobs@gmail.com';"))
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => client.end());
