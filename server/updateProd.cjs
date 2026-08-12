const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:rohan321@localhost:5432/scaloz_super_admin' });
client.connect()
  .then(() => client.query("UPDATE products SET product_name = 'TalentiQ' WHERE product_code = 'SKILLZ';"))
  .then(res => console.log(res.rowCount + ' row(s) updated'))
  .catch(console.error)
  .finally(() => client.end());
