import pg from 'pg';
const { Client } = pg;

const client = new Client({
  user: 'postgres',
  password: 'rohan321',
  host: 'localhost',
  port: 5432,
  database: 'postgres'
});

async function createDatabase() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL default database.');
    
    const res = await client.query("SELECT datname FROM pg_catalog.pg_database WHERE datname = 'xeskillz'");
    if (res.rowCount === 0) {
      console.log('Creating database xeskillz...');
      await client.query('CREATE DATABASE xeskillz');
      console.log('✅ Database created successfully.');
    } else {
      console.log('✅ Database xeskillz already exists.');
    }
  } catch (err) {
    console.error('❌ Error creating database:', err.message);
  } finally {
    await client.end();
  }
}

createDatabase();
