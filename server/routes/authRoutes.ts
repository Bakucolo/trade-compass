import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  isGoogleAuthConfigured,
  getAuthorizedEmails,
  getAppBaseUrl,
} from '../auth';

export function createAuthRouter(): Router {
  const router = Router();

  // 1. Current Session State
  router.get('/me', (req: Request, res: Response) => {
    const googleConfigured = isGoogleAuthConfigured();
    const authorizedEmails = getAuthorizedEmails();
    const user = getSessionFromRequest(req);

    if (!googleConfigured) {
      // If Google Auth isn't configured in environment yet, treat as bypass mode
      return res.json({
        authenticated: true,
        bypassMode: true,
        user: {
          email: authorizedEmails[0] || 'owner@tradeflow.local',
          name: 'Owner (Bypass Mode)',
          picture: '',
        },
        googleConfigured: false,
      });
    }

    if (user) {
      return res.json({
        authenticated: true,
        bypassMode: false,
        user: {
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        googleConfigured: true,
      });
    }

    return res.json({
      authenticated: false,
      bypassMode: false,
      user: null,
      googleConfigured: true,
      authorizedEmailsCount: authorizedEmails.length,
    });
  });

  // 2. Generate Google OAuth Redirect URL
  router.get('/google/url', (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured in .env.local' });
    }

    const baseUrl = getAppBaseUrl(req);
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const state = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.json({ url: googleAuthUrl });
  });

  // 3. Google OAuth Callback
  router.get('/google/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error || !code) {
      console.error('[Google Auth] OAuth error or missing code:', error);
      return res.redirect(`/?auth_error=${encodeURIComponent(error || 'missing_code')}`);
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured on server');
      }

      const baseUrl = getAppBaseUrl(req);
      const redirectUri = `${baseUrl}/api/auth/google/callback`;

      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        console.error('[Google Auth] Failed to exchange token:', errBody);
        return res.redirect('/?auth_error=token_exchange_failed');
      }

      const tokens = await tokenResponse.json();
      const accessToken = tokens.access_token;

      // Fetch user profile from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user profile from Google');
      }

      const userInfo = await userInfoResponse.json();
      const email = (userInfo.email || '').toLowerCase().trim();
      const name = userInfo.name || userInfo.given_name || 'TradeFlow User';
      const picture = userInfo.picture || '';

      if (!email) {
        return res.redirect('/?auth_error=no_email_returned');
      }

      // Verify email authorization
      const authorizedEmails = getAuthorizedEmails();
      if (authorizedEmails.length > 0 && !authorizedEmails.includes(email)) {
        console.warn(`[Google Auth] Blocked unauthorized login attempt by: ${email}`);
        return res.redirect(`/?auth_error=unauthorized_email&email=${encodeURIComponent(email)}`);
      }

      // Generate signed session token
      const sessionToken = createSessionToken({ email, name, picture });
      setSessionCookie(res, req, sessionToken);

      console.log(`[Google Auth] Authorized session established for: ${email}`);
      return res.redirect('/');
    } catch (err: any) {
      console.error('[Google Auth] Authentication error:', err?.message || err);
      return res.redirect(`/?auth_error=${encodeURIComponent(err?.message || 'auth_failed')}`);
    }
  });

  // 4. Logout
  router.post('/logout', (req: Request, res: Response) => {
    clearSessionCookie(res);
    return res.json({ success: true, message: 'Logged out successfully' });
  });

  return router;
}
