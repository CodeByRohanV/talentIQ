import './src/config/env.js';
import app from './src/app.js';
import pool from './src/config/database.js';
import { runMigration } from './src/scripts/migrate.js';
import { AUTH_CONFIG } from './src/config/security.js';

// Increase UV_THREADPOOL_SIZE to handle more concurrent DB operations
process.env.UV_THREADPOOL_SIZE = 128;

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // 1. Run migrations automatically on startup
        // This will create all necessary tables (users, questions, assessments, candidates, responses, results, etc.)
        // if they don't already exist.
        await runMigration();

        // 2. Test database connection
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Database connected successfully');
        console.log('📅 Server time:', res.rows[0].now);

        // 3. Start server
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🔑 JWT Secret (First 10 chars): ${AUTH_CONFIG.JWT_SECRET ? AUTH_CONFIG.JWT_SECRET.substring(0, 10) : 'None'}...`);
            console.log(`🔑 Env JWT Secret (First 10 chars): ${process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 10) : 'None'}...`);
            console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'https://skillztest.scaloz.com'}`);
        });

        // Optimization for high concurrency / load testing
        server.keepAliveTimeout = 65000; // 65 seconds
        server.headersTimeout = 66000;   // Slightly more than keepAliveTimeout

        // 4. Start background sweeper for expired test attempts
        setInterval(() => {
            import('./src/controllers/testController.js').then(({ processAllExpiredTests }) => {
                processAllExpiredTests().catch(err => console.error('Background sweeper error:', err.message));
            });
        }, 60 * 1000); // Every 1 minute

        // Graceful shutdown handler
        const shutdown = (signal) => {
            console.log(`\n${signal} received: closing HTTP server`);
            server.close(() => {
                console.log('HTTP server closed');
                pool.end(() => {
                    console.log('Database pool closed');
                    process.exit(0);
                });
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
}

startServer();


