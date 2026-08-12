import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'xeskillz',
  password: 'rohan321',
  port: 5432,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Find all users with UUID ids and an employee_id that has an underscore
    const users = await client.query(`
        SELECT id, employee_id 
        FROM users 
        WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        AND employee_id LIKE '%_%'
    `);
    
    console.log(`Found ${users.rows.length} bugged users to fix.`);

    for (let u of users.rows) {
        const oldId = u.id;
        const newId = u.employee_id;
        console.log(`Fixing user: ${oldId} -> ${newId}`);
        
        // 1. Temporarily insert the new user record (to avoid constraint errors when updating children)
        // Wait, we can't duplicate email!
        // Instead, drop constraints, update id, update all children, recreate constraints.
        // Or simpler: DEFERRABLE constraints? Not possible if they weren't created as deferrable.
        // Let's manually do it by creating a dummy user, moving everything, then renaming? No.
        
        // Let's just alter the constraints to ON UPDATE CASCADE!
        const tables = [
            { table: 'questions', fk: 'created_by', constraint: 'questions_created_by_fkey' },
            { table: 'questions', fk: 'created_by_manager_id', constraint: 'questions_created_by_manager_id_fkey' },
            { table: 'domains', fk: 'recruiter_id', constraint: 'domains_recruiter_id_fkey' },
            { table: 'domains', fk: 'created_by_manager_id', constraint: 'domains_created_by_manager_id_fkey' },
            { table: 'assessments', fk: 'created_by', constraint: 'assessments_created_by_fkey' },
            { table: 'assessments', fk: 'created_by_manager_id', constraint: 'assessments_created_by_manager_id_fkey' },
            { table: 'user_roles', fk: 'user_id', constraint: 'user_roles_user_id_fkey', cascade: true },
            { table: 'user_roles', fk: 'assigned_by', constraint: 'user_roles_assigned_by_fkey' },
            { table: 'manager_assignments', fk: 'manager_id', constraint: 'manager_assignments_manager_id_fkey', cascade: true },
            { table: 'manager_assignments', fk: 'recruiter_id', constraint: 'manager_assignments_recruiter_id_fkey', cascade: true },
            { table: 'roles', fk: 'created_by', constraint: 'roles_created_by_fkey' },
            { table: 'users', fk: 'manager_id', constraint: 'users_manager_id_fkey' }
        ];

        // Drop and Recreate all constraints with ON UPDATE CASCADE
        for (let t of tables) {
            await client.query(`ALTER TABLE ${t.table} DROP CONSTRAINT IF EXISTS ${t.constraint}`);
            const deleteAction = t.cascade ? 'CASCADE' : 'SET NULL';
            await client.query(`ALTER TABLE ${t.table} ADD CONSTRAINT ${t.constraint} FOREIGN KEY (${t.fk}) REFERENCES users(id) ON DELETE ${deleteAction} ON UPDATE CASCADE`);
        }

        // Now we can just update the users table and it will cascade!
        await client.query(`UPDATE users SET id = $1 WHERE id = $2`, [newId, oldId]);
        console.log(`Updated! Cascaded to all tables.`);
    }

    await client.query('COMMIT');
    console.log('Done!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
