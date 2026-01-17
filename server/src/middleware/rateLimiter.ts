import rateLimit from 'express-rate-limit';
import { config } from '../config/env';

// In development, use relaxed limits; in production, use stricter limits
const isDev = config.nodeEnv !== 'production';

/**
 * Rate limiter for authentication endpoints
 * Prevents brute-force attacks on login
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 100 : 10, // 10 attempts per window in production
    message: { error: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

/**
 * Rate limiter for report submission
 * Prevents spam/abuse of the submission endpoint
 */
export const submitRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isDev ? 100 : 10, // 10 submissions per hour in production
    message: { error: 'Zu viele Hinweise. Bitte versuchen Sie es später erneut.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isDev ? 500 : 100, // 100 requests per minute in production
    message: { error: 'Zu viele Anfragen. Bitte verlangsamen Sie.' },
    standardHeaders: true,
    legacyHeaders: false,
});
