const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:rohan321@localhost:5432/scaloz_super_admin' });
client.connect()
  .then(() => client.query("UPDATE products SET sync_user_url = 'http://localhost:5000/api/auth/sync-user' WHERE product_code = 'SKILLZ';"))
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => client.end());
