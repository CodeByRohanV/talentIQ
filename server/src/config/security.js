/**
 * Centralized Security Configuration
 * Defines default anti-cheating measures and security-related constants.
 */

export const DEFAULT_SECURITY_CONFIG = {
    // Basic detection
    disableRightClick: false,
    disableCopyPaste: false,
    maxTabSwitchWarnings: 3,
    fullscreenRequired: false,
    autoSubmitOnViolation: false,

    // Advanced detection
    disablePrintScreen: false,
    monitorWindowResize: false,
    detectDevTools: false,
};

export const VIOLATION_TYPES = {
    TAB_SWITCH: 'tab_switch',
    FULLSCREEN_EXIT: 'fullscreen_exit',
    FORBIDDEN_ACTION: 'forbidden_action',
    RESIZE: 'resize',
    DEVTOOLS: 'devtools',
    PRINTSCREEN: 'printscreen',
};

import crypto from 'crypto';

export const AUTH_CONFIG = {
    // Generate a fresh 64-character hex secret ONLY if not provided.
    // In development, we use a fixed fallback to avoid logouts on every file save.
    JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
        ? crypto.randomBytes(64).toString('hex')
        : 'skillz_dev_secret_stable_key_12345'),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    SALT_ROUNDS: 10,

    // Scaloz Workspace SSO secret — must match scaloz.app.jwtSecret in the Scaloz Spring Boot backend.
    // Set SCALOZ_JWT_SECRET in your deployment environment to match what Scaloz uses.
    // Default below is the Scaloz application.properties hardcoded fallback.
    SCALOZ_JWT_SECRET: process.env.SCALOZ_JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250655368566D5970',
};
