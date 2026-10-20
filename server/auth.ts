import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const SESSION_COOKIE_NAME = 'tradeflow_session';
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Get session signing secret
function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || 'tradeflow_default_secure_vault_hmac_2026';
}

// Get authorized emails list
export function getAuthorizedEmails(): string[] {
  const envEmails = process.env.AUTHORIZED_EMAILS || process.env.OWNER_EMAIL || '';
  return envEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

// Sign session token with HMAC-SHA256
export function createSessionToken(user: Omit<AuthUser, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthUser = {
    ...user,
    email: user.email.toLowerCase(),
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

// Verify session token
export function verifySessionToken(token: string): AuthUser | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payloadB64)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: AuthUser = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    // Double check email authorization
    const authorizedEmails = getAuthorizedEmails();
    if (authorizedEmails.length > 0 && !authorizedEmails.includes(payload.email.toLowerCase())) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Parse cookie string
function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    const value = parts.slice(1).join('=').trim();
    if (name) list[name] = decodeURIComponent(value);
  });

  return list;
}

// Extract session from Request
export function getSessionFromRequest(req: Request): AuthUser | null {
  // 1. Check Cookie
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    const user = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
    if (user) return user;
  }

  // 2. Check Bearer Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }

  return null;
}

// Is Google OAuth configured?
export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Master PIN Authentication
export function getMasterPin(): string | null {
  return process.env.APP_MASTER_PIN || process.env.MASTER_PIN || null;
}

export function isPinAuthConfigured(): boolean {
  return Boolean(getMasterPin());
}

// Brute-force Rate Limiting for PIN attempts
interface RateLimitRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}

const pinRateLimits = new Map<string, RateLimitRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export function checkPinRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = pinRateLimits.get(ip);
  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS, retryAfterSeconds: 0 };
  }

  // Check if locked out
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  // If lockout expired or last attempt was > 15m ago, reset
  if (record.lockedUntil <= now && record.lockedUntil > 0) {
    pinRateLimits.delete(ip);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS, retryAfterSeconds: 0 };
  }

  if (now - record.lastAttempt > LOCKOUT_DURATION_MS) {
    pinRateLimits.delete(ip);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS, retryAfterSeconds: 0 };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts);
  return { allowed: remaining > 0, remainingAttempts: remaining, retryAfterSeconds: 0 };
}

export function recordFailedPinAttempt(ip: string): { remainingAttempts: number; lockedOut: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = pinRateLimits.get(ip) || { attempts: 0, lastAttempt: now, lockedUntil: 0 };

  record.attempts += 1;
  record.lastAttempt = now;

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    pinRateLimits.set(ip, record);
    return {
      remainingAttempts: 0,
      lockedOut: true,
      retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  pinRateLimits.set(ip, record);
  return {
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts),
    lockedOut: false,
    retryAfterSeconds: 0,
  };
}

export function resetPinRateLimit(ip: string): void {
  pinRateLimits.delete(ip);
}

// Constant-Time Cryptographic PIN Verification
export function verifyMasterPin(candidate: string): boolean {
  const masterPin = getMasterPin();
  if (!masterPin || !candidate) return false;

  const candidateNorm = String(candidate).trim();
  const masterNorm = String(masterPin).trim();

  // Hash both with SHA-256 to ensure identical length buffers before timingSafeEqual
  const candidateHash = crypto.createHash('sha256').update(candidateNorm).digest();
  const masterHash = crypto.createHash('sha256').update(masterNorm).digest();

  return crypto.timingSafeEqual(candidateHash, masterHash);
}

// Infer app public URL
export function getAppBaseUrl(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

// Express Auth Middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // If neither PIN nor Google Auth is configured in environment, allow bypass
  if (!isPinAuthConfigured() && !isGoogleAuthConfigured()) {
    return next();
  }

  // Exempt public endpoints
  if (
    req.path.startsWith('/api/auth/') ||
    req.path === '/api/telegram/buffer/consume' || // External Cloudflare worker webhook
    req.path === '/api/health' ||
    req.path === '/api/telegram/webhook'
  ) {
    return next();
  }

  const user = getSessionFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized. Terminal is locked.',
      code: 'AUTH_REQUIRED',
    });
  }

  req.user = user;
  next();
}

// Set session cookie helper
export function setSessionCookie(res: Response, req: Request, token: string) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS * 1000,
  });
}

// Clear session cookie helper
export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}
