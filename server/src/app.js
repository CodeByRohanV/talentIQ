import './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.js';
import integrationRoutes from './routes/integration.js';
import questionRoutes from './routes/questions.js';
import assessmentRoutes from './routes/assessments.js';
import candidateRoutes from './routes/candidates.js';
import testRoutes from './routes/test.js';
import resultRoutes from './routes/results.js';
import dashboardRoutes from './routes/dashboard.js';
import domainRoutes from './routes/domains.js';
import adminRoutes from './routes/admin.js';
import proctoringRoutes from './routes/proctoring.js';
import { syncUser, syncTenant } from './controllers/syncController.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
app.set('trust proxy', 1);


// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['https://skillz.scaloz.com', 'http://skillz.scaloz.com', 'https://*.skillz.scaloz.com', 'http://*.skillz.scaloz.com'];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Case-insensitive check for allowed origins (supporting wildcards like *.skillz.scaloz.com)
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed === '*') return true;
            if (allowed.toLowerCase() === origin.toLowerCase()) return true;
            
            if (allowed.includes('*')) {
                // Escape regex special chars except * and replace * with a pattern for valid subdomains
                const escaped = allowed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-zA-Z0-9-]+');
                const regex = new RegExp(`^${escaped}$`, 'i');
                return regex.test(origin);
            }
            return false;
        }) || /^https?:\/\/([a-zA-Z0-9-]+\.)?localhost(:\d+)?$/.test(origin);

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Serve static uploads with CORS enabled
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || (process.env.NODE_ENV === 'production' ? 10000 : 5000), 
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(['/api/', '/'], (req, res, next) => {
    // Skip general limit for test routes as they have their own higher limit
    if (req.path.startsWith('/api/test') || req.path.startsWith('/test')) {
        return next();
    }
    limiter(req, res, next);
});

// Dedicated limiter for Assessment/Test taking - much higher to support concurrent users from same IP
const testLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.TEST_RATE_LIMIT_MAX) || 50000, // Very high to support large batches (e.g. 500+ candidates from one campus)
    message: 'High traffic detected from your network. Please wait a moment and refresh.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(['/api/test', '/test'], testLimiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 500, 
    message: 'Too many authentication attempts, please try again later.'
});
app.use(['/api/auth/login', '/auth/login', '/api/auth/register', '/auth/register'], authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes - support both /api prefix and root paths (for different proxy configs)
const routes = [
    { path: ['/api/auth', '/auth'], handler: authRoutes },
    { path: ['/api/integration', '/integration'], handler: integrationRoutes },
    { path: ['/api/questions', '/questions', '/api/question-banks', '/question-banks'], handler: questionRoutes },
    { path: ['/api/assessments', '/assessments'], handler: assessmentRoutes },
    { path: ['/api/candidates', '/candidates'], handler: candidateRoutes },
    { path: ['/api/test', '/test'], handler: testRoutes },
    { path: ['/api/results', '/results'], handler: resultRoutes },
    { path: ['/api/dashboard', '/dashboard'], handler: dashboardRoutes },
    { path: ['/api/domains', '/domains'], handler: domainRoutes },
    { path: ['/api/admin', '/admin'], handler: adminRoutes },
    { path: ['/api/proctoring', '/proctoring'], handler: proctoringRoutes }
];

// Support fallback/external sync URLs called by Scaloz Workspace by default
app.post(['/api/external/employees', '/external/employees'], syncUser);
app.post(['/api/external/tenants', '/external/tenants'], syncTenant);

routes.forEach(route => {
    if (Array.isArray(route.path)) {
        route.path.forEach(p => app.use(p, route.handler));
    } else {
        app.use(route.path, route.handler);
    }
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

export default app;
