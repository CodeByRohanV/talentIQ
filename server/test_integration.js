import pg from 'pg';
import jwt from 'jsonwebtoken';

const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'xeskillz',
  password: 'rohan321',
  port: 5432,
});

async function run() {
    console.log('Testing User Creation and Domain findOrCreateDomain...');

    try {
        // Admin token (mock)
        const secret = '4b3153e32c221d2b8d5d6657805e52682653f103c46d04367f2b2399a50fe6724f4baac8392841a737b9beafe548c6ed5a74d27844540a084644312e0f55885b';
        const adminToken = jwt.sign({ 
            userId: 'rohan_EMP001',
            tenantId: 'rohan',
            roles: ['SUPER_ADMIN']
        }, secret);

        // 1. Test Admin createUser endpoint
        console.log('1. Creating user...');
        const createRes = await fetch('http://localhost:5000/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                email: 'test_new_user_2@xevyte.com',
                fullName: 'Test User 2',
                roleName: 'RECRUITER',
                employeeId: 'TEST999_2',
                tenantId: 'rohan'
            })
        });
        
        const createData = await createRes.json();
        console.log('Create User response:', createData);

        const userQuery = await pool.query(`SELECT id FROM users WHERE email = 'test_new_user_2@xevyte.com'`);
        const createdUserId = userQuery.rows[0].id;
        console.log('Created User ID:', createdUserId);

        if (!createdUserId.includes('_')) {
             console.error('User ID does not contain underscore! Fix failed!');
        } else {
             console.log('User ID correctly prefixed with tenant!');
        }

        console.log('2. Testing bulk upload for a UUID user (simulating existing bugged user)...');
        const buggedUserId = '11111111-2222-3333-4444-555555555555';
        
        await pool.query(`
            INSERT INTO users (id, email, password_hash, full_name, employee_id, must_change_password, is_verified)
            VALUES ($1, 'uuid_user@test.com', 'hash', 'UUID User', 'UUID001', false, true)
            ON CONFLICT DO NOTHING
        `, [buggedUserId]);

        // Mock token reflecting the fixed login logic
        const uuidToken = jwt.sign({ 
            userId: buggedUserId,
            tenantId: buggedUserId // login logic derives tenantId from UUID by split('_')[0] which is the full UUID
        }, secret);

        const uploadRes1 = await fetch('http://localhost:5000/api/questions/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${uuidToken}`
            },
            body: JSON.stringify({
                questions: [
                    {
                        domain: 'uuid_domain',
                        domainName: 'UUID Domain',
                        questionText: 'Test question 1?',
                        options: ['1', '2', '3', '4'],
                        correctAnswer: 1,
                        difficulty: 'easy'
                    }
                ]
            })
        });
        
        const uploadData1 = await uploadRes1.json();
        console.log('Upload 1 response:', uploadRes1.status, uploadData1);

        // Upload again to see if 409 occurs!
        const uploadRes2 = await fetch('http://localhost:5000/api/questions/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${uuidToken}`
            },
            body: JSON.stringify({
                questions: [
                    {
                        domain: 'uuid_domain',
                        domainName: 'UUID Domain',
                        questionText: 'Test question 2?',
                        options: ['1', '2', '3', '4'],
                        correctAnswer: 1,
                        difficulty: 'easy'
                    }
                ]
            })
        });

        const uploadData2 = await uploadRes2.json();
        console.log('Upload 2 response (should not be 409):', uploadRes2.status, uploadData2);

        // 4. Test cascading deletes
        console.log('3. Testing cascading deletes...');
        
        // Make sure questions were created
        const qCount = await pool.query(`SELECT COUNT(*) FROM questions WHERE created_by = $1`, [buggedUserId]);
        console.log(`Questions owned by UUID user before delete: ${qCount.rows[0].count}`);

        // Delete the user
        await pool.query(`DELETE FROM users WHERE id = $1`, [buggedUserId]);

        // Check questions again
        const qCountAfter = await pool.query(`SELECT COUNT(*) FROM questions WHERE created_by = $1`, [buggedUserId]);
        console.log(`Questions owned by UUID user after delete: ${qCountAfter.rows[0].count}`);

        const totalQAfter = await pool.query(`SELECT COUNT(*) FROM questions WHERE question_text LIKE 'Test question %?'`);
        console.log(`Total test questions remaining: ${totalQAfter.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
