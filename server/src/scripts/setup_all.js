import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'aptitude_ace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function runMigrations() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Database Setup...');

        // 1. Ensure schema_migrations table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Read and apply migrations in order
        const migrationsDir = join(__dirname, '../../migrations');
        const files = readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        const { rows } = await client.query('SELECT filename FROM schema_migrations');
        const applied = new Set(rows.map(r => r.filename));

        for (const file of files) {
            if (applied.has(file)) {
                console.log(`✅ ${file} already applied.`);
                continue;
            }

            console.log(`📄 Applying ${file}...`);
            const sql = readFileSync(join(migrationsDir, file), 'utf8');
            
            try {
                await client.query('BEGIN');
                // Split by semicolon and run separately to handle multiple statements if needed, 
                // but client.query usually handles multiple if they are separated by semicolons.
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`✅ ${file} success.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Error in ${file}:`, err.message);
                // Continue or exit? Better to exit if foundational schema fails.
                if (file.startsWith('001')) throw err;
            }
        }

        // 3. Seed RBAC if needed
        console.log('🔑 Seeding RBAC system...');
        const seedPath = join(__dirname, 'seed_rbac.js');
        // We can import it dynamically or just run the queries. 
        // For simplicity, we'll suggest the user runs the seed_rbac script next or we can try to call it.
        try {
            const { seedRBAC } = await import('./seed_rbac.js');
            await seedRBAC();
            console.log('✅ RBAC Seeded.');
        } catch (err) {
            console.warn('⚠️ seed_rbac.js not found or failed, skipping manual seed phase.');
        }

        console.log('🎉 Database Setup Complete!');
    } catch (err) {
        console.error('💥 Setup Failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();
