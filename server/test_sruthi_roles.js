import { query } from './src/config/database.js';

async function main() {
  try {
    const res = await query(
      `SELECT r.name, p.code 
       FROM user_roles ur 
       JOIN roles r ON ur.role_id = r.id 
       JOIN role_permissions rp ON r.id = rp.role_id 
       JOIN permissions p ON rp.permission_id = p.id 
       WHERE ur.user_id = 'rohan_01014'`
    );
    console.log('Roles/Permissions:', res.rows);
  } catch (err) {
    console.error('Failed!', err);
  }
}

main().catch(console.error).then(() => process.exit(0));
