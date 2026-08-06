import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔄 Checking database schema (Auto-Migration)...');

        // 1. Create migrations table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Get list of applied migrations
        const { rows } = await client.query('SELECT filename FROM schema_migrations');
        const appliedMigrations = new Set(rows.map(r => r.filename));

        // 3. Read migration files
        const migrationsDir = join(__dirname, '../../migrations');
        const files = readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        let appliedCount = 0;

        for (const file of files) {
            if (appliedMigrations.has(file)) {
                continue;
            }

            console.log(`📄 Applying migration: ${file}...`);
            const migrationPath = join(migrationsDir, file);
            const sql = readFileSync(migrationPath, 'utf8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
                appliedCount++;
                console.log(`✅ ${file} applied successfully`);
            } catch (error) {
                await client.query('ROLLBACK');

                // If the error is "already exists", we can consider it "applied" in some cases,
                // but it's safer to report the error and stop.
                // However, for the very first run of this new system, we might encounter 
                // things that exist. We'll log and throw to be safe.
                console.error(`❌ Error in ${file}:`, error.message);
                throw error;
            }
        }

        if (appliedCount > 0) {
            console.log(`✅ Applied ${appliedCount} new migrations.`);
        } else {
            console.log('✅ Database schema is up to date.');
        }
    } catch (error) {
        console.error('❌ Auto-migration failed:', error.message);
        // We throw so the server doesn't start with a broken schema
        throw error;
    } finally {
        client.release();
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration().then(() => {
        console.log('🚀 Migration process finished.');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    });
}
