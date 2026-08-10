import jwt from 'jsonwebtoken';
import { AUTH_CONFIG } from '../config/security.js';

/**
 * JWT Utility
 * Handles token generation and verification using centralized config.
 *
 * Verification tries two secrets in order:
 *  1. SCALOZ_JWT_SECRET — tokens minted by the Scaloz Workspace SSO backend
 *  2. JWT_SECRET        — tokens minted locally by this Skillz server
 *
 * This means SSO tokens from Scaloz pass, AND locally-generated tokens still work.
 */
export const generateToken = (userId, tenantId, roleIds, managerId = null, domainId = null, tokenVersion = 1) => {
    try {
        if (!userId) {
            throw new Error('UserId is required to generate a token');
        }

        return jwt.sign(
            { userId, tenantId, roleIds, managerId, domainId, tokenVersion },
            AUTH_CONFIG.JWT_SECRET,
            { expiresIn: AUTH_CONFIG.JWT_EXPIRES_IN }
        );
    } catch (error) {
        console.error('Error generating JWT:', error.message);
        throw error;
    }
};

export const verifyToken = (token) => {
    if (!token) return null;

    // Try each accepted secret in priority order.
    // Scaloz SSO tokens are tried first; locally-minted Skillz tokens are tried second.
    // Scaloz Workspace tokens are signed using the base64-decoded bytes of SCALOZ_JWT_SECRET in Spring Boot.
    // We add decoded buffers to the secrets array to ensure they match the signature.
    const secrets = [];
    if (AUTH_CONFIG.SCALOZ_JWT_SECRET) {
        // 1. Try base64-decoded bytes (common for JJWT default configuration)
        try {
            secrets.push(Buffer.from(AUTH_CONFIG.SCALOZ_JWT_SECRET, 'base64'));
        } catch (e) {
            console.error('Failed to decode SCALOZ_JWT_SECRET as base64:', e.message);
        }

        // 2. Try hex-decoded bytes (if the secret happens to be a valid hex string in some envs)
        if (/^[0-9a-fA-F]+$/.test(AUTH_CONFIG.SCALOZ_JWT_SECRET)) {
            try {
                secrets.push(Buffer.from(AUTH_CONFIG.SCALOZ_JWT_SECRET, 'hex'));
            } catch (e) {
                console.error('Failed to decode SCALOZ_JWT_SECRET as hex:', e.message);
            }
        }

        // 3. Fallback to literal UTF-8 string
        secrets.push(AUTH_CONFIG.SCALOZ_JWT_SECRET);
    }

    if (AUTH_CONFIG.JWT_SECRET) {
        secrets.push(AUTH_CONFIG.JWT_SECRET);
    }

    for (const secret of secrets) {
        try {
            const decoded = jwt.verify(token, secret);
            return decoded; // valid — return decoded payload immediately
        } catch (error) {
            // TokenExpiredError is a definitive failure regardless of secret — re-throw
            if (error.name === 'TokenExpiredError') {
                console.error('JWT Verification Error: token has expired');
                return null;
            }
            // InvalidSignatureError just means this secret is wrong — try the next one
        }
    }

    // No secret matched
    console.error('JWT Verification Error: token signature does not match any known secret');
    return null;
};

/**
 * Decode token without verification (useful for logging/debugging)
 */
export const decodeToken = (token) => {
    return jwt.decode(token);
};
