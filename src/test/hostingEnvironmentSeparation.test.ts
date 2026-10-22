import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isCloudHosting, getHostingEnvironmentInfo, setHostingMode } from '../../server/services/environmentService';
import { isClientCloud } from '../services/environmentService';
import { COPILOT_MODELS } from '../components/HybridAgentCopilot';

describe('Hosting Environment & Cloud Feature Separation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.IS_CLOUD;
    delete process.env.HOSTING_MODE;
    delete process.env.HOSTING_ENV;
    delete process.env.DEPLOY_ENV;
    delete process.env.RENDER;
    delete process.env.FLY_APP_NAME;
    delete process.env.CF_PAGES;
    delete process.env.NODE_ENV;
    delete process.env.APP_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('isCloudHosting Detection Logic', () => {
    it('returns false by default in local dev environment without cloud flags', () => {
      expect(isCloudHosting()).toBe(false);
    });

    it('returns true when IS_CLOUD=true or IS_CLOUD=1', () => {
      process.env.IS_CLOUD = 'true';
      expect(isCloudHosting()).toBe(true);

      process.env.IS_CLOUD = '1';
      expect(isCloudHosting()).toBe(true);
    });

    it('returns false when IS_CLOUD=false even if NODE_ENV=production', () => {
      process.env.IS_CLOUD = 'false';
      process.env.NODE_ENV = 'production';
      expect(isCloudHosting()).toBe(false);
    });

    it('returns true when HOSTING_MODE=cloud', () => {
      process.env.HOSTING_MODE = 'cloud';
      expect(isCloudHosting()).toBe(true);
    });

    it('returns false when HOSTING_MODE=local even if on a cloud provider', () => {
      process.env.HOSTING_MODE = 'local';
      process.env.RENDER = 'true';
      expect(isCloudHosting()).toBe(false);
    });

    it('detects cloud platforms like Render, Fly.io, Cloudflare Pages', () => {
      process.env.RENDER = 'true';
      expect(isCloudHosting()).toBe(true);
    });

    it('detects production APP_URL on remote domains', () => {
      process.env.APP_URL = 'https://trade-compass.production.domain.com';
      expect(isCloudHosting()).toBe(true);
    });
  });

  describe('getHostingEnvironmentInfo Metadata & Features', () => {
    it('disables Ollama & Python LangGraph on cloud while keeping cloud LLMs and brokers active', () => {
      process.env.IS_CLOUD = 'true';
      const info = getHostingEnvironmentInfo();

      expect(info.isCloud).toBe(true);
      expect(info.isLocalhost).toBe(false);
      expect(info.hostingMode).toBe('cloud');

      // Local-only features disabled on cloud:
      expect(info.features.ollamaLocal).toBe(false);
      expect(info.features.pythonLangGraphLocal).toBe(false);

      // Cloud-native features enabled:
      expect(info.features.cloudLLM).toBe(true);
      expect(info.features.tastytradeCloud).toBe(true);
      expect(info.features.trading212Cloud).toBe(true);
      expect(info.features.telegramHub).toBe(true);
      expect(info.features.vectorChartsPdf).toBe(true);

      expect(info.recommendations.notes).toContain('24/7 Cloud Hosting');
    });

    it('enables Ollama & Python LangGraph when running in localhost mode', () => {
      process.env.IS_CLOUD = 'false';
      const info = getHostingEnvironmentInfo();

      expect(info.isCloud).toBe(false);
      expect(info.isLocalhost).toBe(true);
      expect(info.hostingMode).toBe('local');

      expect(info.features.ollamaLocal).toBe(true);
      expect(info.features.pythonLangGraphLocal).toBe(true);
      expect(info.features.ibkrLocalGateway).toBe(true);
    });
  });

  describe('Client-Side isClientCloud Hostname Detection', () => {
    it('identifies localhost and loopback IPs as local', () => {
      // In vitest / jsdom default window.location.hostname is localhost
      expect(isClientCloud()).toBe(false);
    });
  });

  describe('AI Copilot Model Configurations', () => {
    it('contains Ollama model marked with isLocal=true', () => {
      const ollamaModel = COPILOT_MODELS.find((m) => m.id === 'ollama');
      expect(ollamaModel).toBeDefined();
      expect(ollamaModel?.isLocal).toBe(true);
      expect(ollamaModel?.desc).toContain('Localhost');
    });

    it('provides cloud frontier alternatives (Gemini, Ling Finance, Llama 3.3)', () => {
      const gemini = COPILOT_MODELS.find((m) => m.id.includes('gemini'));
      const ling = COPILOT_MODELS.find((m) => m.id.includes('ling'));
      const llama = COPILOT_MODELS.find((m) => m.id.includes('llama'));

      expect(gemini).toBeDefined();
      expect(ling).toBeDefined();
      expect(llama).toBeDefined();
    });
  });
});
