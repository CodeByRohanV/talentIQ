/**
 * Middleware for role and permission checks
 */

export const requirePermission = (permissionCode) => {
    return (req, res, next) => {
        if (!req.auth) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { permissions } = req.auth;

        if (permissions.includes(permissionCode) || permissions.includes('all')) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: `Forbidden: Missing permission ${permissionCode}`
        });
    };
};

export const requireRole = (roleName) => {
    return (req, res, next) => {
        if (!req.auth) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { roles } = req.auth;

        if (roles.includes(roleName) || roles.includes('SUPER_ADMIN')) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: `Forbidden: Missing role ${roleName}`
        });
    };
};
