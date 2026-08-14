export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Database errors
    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'Resource already exists',
            error: err.detail
        });
    }

    if (err.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'Invalid reference',
            error: err.detail
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }

    // Default error
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

export const notFound = (req, res) => {
    console.log(`404 Route Not Found: ${req.method} ${req.originalUrl} (path: ${req.path})`);
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
};
