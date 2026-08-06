# Aptitude Ace Backend

Node.js + Express + PostgreSQL backend for the Aptitude Ace platform.

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Setup PostgreSQL Database

Create a new PostgreSQL database:

```sql
CREATE DATABASE aptitude_ace;
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and update with your configuration:

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=aptitude_ace
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
```

### 4. Run Database Migrations

```bash
psql -U postgres -d aptitude_ace -f migrations/001_initial_schema.sql
```

Or using the migration script:
```bash
npm run migrate
```

### 5. Start the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)
- `PUT /api/auth/profile` - Update profile (protected)

### Questions
- `GET /api/questions` - List questions (protected)
- `POST /api/questions` - Create question (protected)
- `POST /api/questions/bulk` - Bulk create questions (protected)
- `DELETE /api/questions/:id` - Delete question (protected)
- `DELETE /api/questions/bulk` - Bulk delete questions (protected)
- `GET /api/questions/usage` - Check question usage (protected)

### Assessments
- `GET /api/assessments` - List assessments (protected)
- `POST /api/assessments` - Create assessment (protected)
- `GET /api/assessments/:id` - Get assessment (protected)
- `PUT /api/assessments/:id` - Update assessment (protected)
- `DELETE /api/assessments/:id` - Delete assessment (protected)
- `GET /api/assessments/:id/questions` - Get assessment questions (protected)
- `POST /api/assessments/:id/questions` - Assign questions (protected)

### Candidates
- `GET /api/candidates` - List candidates (protected)
- `POST /api/candidates` - Create candidate (protected)
- `GET /api/candidates/token/:token` - Get candidate by token (public)

### Test (Public - accessed via candidate token)
- `GET /api/test/:token` - Get test details
- `POST /api/test/:token/start` - Start test
- `POST /api/test/:token/response` - Save response
- `POST /api/test/:token/submit` - Submit test

### Results
- `GET /api/results` - List all results (protected)
- `GET /api/results/candidate/:candidateId` - Get result by candidate (protected)
- `GET /api/results/assessment/:assessmentId` - Get results by assessment (protected)

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── controllers/             # Request handlers
│   ├── middleware/              # Express middleware
│   ├── models/                  # Database models
│   ├── routes/                  # API routes
│   ├── utils/                   # Utility functions
│   └── app.js                   # Express app setup
├── migrations/                  # Database migrations
├── .env.example                 # Environment template
├── package.json
└── server.js                    # Entry point
```

## Security Features

- JWT authentication
- bcrypt password hashing (10 salt rounds)
- Helmet.js security headers
- CORS configuration
- Rate limiting (100 req/15min general, 10 req/15min auth)
- Input validation
- SQL injection prevention (parameterized queries)

## Development

The server uses Node.js built-in `--watch` flag for auto-reload in development mode.

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure proper database credentials
4. Enable SSL for database connections
5. Use a process manager (PM2, systemd)
6. Setup reverse proxy (nginx)
7. Configure proper CORS origins

## Troubleshooting

**Database connection fails:**
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists

**Port already in use:**
- Change `PORT` in `.env`
- Kill process using port 5000

**CORS errors:**
- Update `CORS_ORIGIN` in `.env` to match frontend URL
