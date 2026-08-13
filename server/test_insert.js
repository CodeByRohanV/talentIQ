import { query } from './src/config/database.js';

async function main() {
  try {
    const res = await query(
      `INSERT INTO users (id, email, full_name, password_hash, is_verified) 
       VALUES ($1, $2, $3, 'sso_user', true) 
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
      ['rohan-local-dev_test', 'test@test.com', 'Test User']
    );
    console.log('Success!', res);
  } catch (err) {
    console.error('Failed!', err);
  }
}

main().catch(console.error).then(() => process.exit(0));
