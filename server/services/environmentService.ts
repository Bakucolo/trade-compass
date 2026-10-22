import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Request } from 'express';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

export type HostingMode = 'cloud' | 'local';

export interface HostingFeatures {
  cloudLLM: boolean;
  gemini: boolean;
  groq: boolean;
  openrouter: boolean;
  tastytradeCloud: boolean;
  trading212Cloud: boolean;
  telegramHub: boolean;
  marketDataCloud: boolean;
  vectorChartsPdf: boolean;
  // Localhost-only features:
  ollamaLocal: boolean;
  pythonLangGraphLocal: boolean;
  ibkrLocalGateway: boolean;
}

export interface HostingEnvironmentInfo {
  hostingMode: HostingMode;
  isCloud: boolean;
  isLocalhost: boolean;
  version: string;
  detectedFrom: string;
  clientIp?: string;
  hostname?: string;
  features: HostingFeatures;
  recommendations: {
    copilotModel: string;
    notes: string;
  };
}

/**
 * Determines whether the current deployment is running in Cloud hosting mode.
 * Rules:
 * 1. Explicit override via IS_CLOUD / HOSTING_MODE / DEPLOY_ENV
 * 2. Cloud platform env vars (Cloudflare, Fly.io, Render, GCP, AWS, etc.)
 * 3. NODE_ENV === 'production' without an explicit local override
 */
export function isCloudHosting(): boolean {
  // Explicit environment flag overrides
  if (process.env.IS_CLOUD !== undefined) {
    const val = process.env.IS_CLOUD.trim().toLowerCase();
    return val === 'true' || val === '1' || val === 'yes';
  }

  const hostingMode = (process.env.HOSTING_MODE || process.env.HOSTING_ENV || process.env.DEPLOY_ENV || '').trim().toLowerCase();
  if (hostingMode === 'cloud' || hostingMode === 'production') {
    return true;
  }
  if (hostingMode === 'local' || hostingMode === 'localhost' || hostingMode === 'development') {
    return false;
  }

  // Cloud platform signature detection
  const isCloudPlatform = Boolean(
    process.env.RENDER ||
    process.env.FLY_APP_NAME ||
    process.env.K_SERVICE ||
    process.env.CF_PAGES ||
    process.env.VERCEL ||
    process.env.HEROKU ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.AWS_EXECUTION_ENV
  );
  if (isCloudPlatform) {
    return true;
  }

  // If NODE_ENV is production and not explicitly disabled
  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  // Check APP_URL if it points to an external domain (not localhost)
  if (process.env.APP_URL) {
    const url = process.env.APP_URL.toLowerCase();
    if (!url.includes('localhost') && !url.includes('127.0.0.1') && !url.includes('0.0.0.0')) {
      return true;
    }
  }

  return false;
}

/**
 * Gets detailed metadata about the current hosting environment and feature availability.
 */
export function getHostingEnvironmentInfo(req?: Request): HostingEnvironmentInfo {
  const isCloud = isCloudHosting();
  const isLocalhost = !isCloud;

  let detectedFrom = 'default_local';
  if (process.env.IS_CLOUD !== undefined) {
    detectedFrom = 'IS_CLOUD_env';
  } else if (process.env.HOSTING_MODE || process.env.HOSTING_ENV || process.env.DEPLOY_ENV) {
    detectedFrom = 'HOSTING_MODE_env';
  } else if (
    process.env.RENDER ||
    process.env.FLY_APP_NAME ||
    process.env.K_SERVICE ||
    process.env.CF_PAGES ||
    process.env.VERCEL ||
    process.env.HEROKU ||
    process.env.RAILWAY_ENVIRONMENT
  ) {
    detectedFrom = 'cloud_platform_signature';
  } else if (process.env.NODE_ENV === 'production') {
    detectedFrom = 'NODE_ENV_production';
  }

  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

  const hasRemoteIbkrGateway = Boolean(
    process.env.IBKR_GATEWAY_URL &&
    !process.env.IBKR_GATEWAY_URL.includes('localhost') &&
    !process.env.IBKR_GATEWAY_URL.includes('127.0.0.1')
  );

  return {
    hostingMode: isCloud ? 'cloud' : 'local',
    isCloud,
    isLocalhost,
    version: '2.5.0',
    detectedFrom,
    clientIp: req ? (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress : undefined,
    hostname: req ? req.hostname : undefined,
    features: {
      cloudLLM: true,
      gemini: hasGemini,
      groq: hasGroq,
      openrouter: hasOpenRouter,
      tastytradeCloud: true,
      trading212Cloud: true,
      telegramHub: true,
      marketDataCloud: true,
      vectorChartsPdf: true,
      // Localhost-only features disabled on cloud:
      ollamaLocal: !isCloud,
      pythonLangGraphLocal: !isCloud,
      ibkrLocalGateway: !isCloud || hasRemoteIbkrGateway
    },
    recommendations: {
      copilotModel: isCloud
        ? (hasGemini ? 'google/gemini-2.0-flash-exp:free' : 'auto')
        : 'auto',
      notes: isCloud
        ? 'Running in 24/7 Cloud Hosting mode. High-speed cloud AI models (Gemini / Groq / OpenRouter) and cloud daemons active. Local Ollama & local python scripts are safely disabled to preserve cloud stability.'
        : 'Running in Localhost mode. Local Ollama (llama3.1) and local IBKR Client Portal Gateway available.'
    }
  };
}

/**
 * Updates the hosting mode in `.env.local` and runtime environment
 */
export function setHostingMode(mode: HostingMode): void {
  const isCloud = mode === 'cloud';
  process.env.HOSTING_MODE = mode;
  process.env.IS_CLOUD = isCloud ? 'true' : 'false';

  const envPath = path.resolve(process.cwd(), '.env.local');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

  if (/^HOSTING_MODE=/m.test(envContent)) {
    envContent = envContent.replace(/^HOSTING_MODE=.*$/m, `HOSTING_MODE=${mode}`);
  } else {
    envContent += `\nHOSTING_MODE=${mode}`;
  }

  if (/^IS_CLOUD=/m.test(envContent)) {
    envContent = envContent.replace(/^IS_CLOUD=.*$/m, `IS_CLOUD=${isCloud ? 'true' : 'false'}`);
  } else {
    envContent += `\nIS_CLOUD=${isCloud ? 'true' : 'false'}`;
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
}
