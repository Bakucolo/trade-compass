import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executeWithFallback,
  generateJsonCompletion,
  generateTextCompletion,
  getFallbackRouterStats,
  resetFallbackRouterCooldowns,
  sanitizeJsonResponse,
  circuitBreaker,
} from '../../server/services/llmFallbackRouter';

describe('Robust LLM API Fallback Router', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENROUTER_API_KEY: 'mock-openrouter-key',
      GEMINI_API_KEY: 'mock-gemini-key',
      GROQ_API_KEY: 'mock-groq-key',
    };
    resetFallbackRouterCooldowns();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetFallbackRouterCooldowns();
    vi.restoreAllMocks();
  });

  it('successfully completes request using primary provider (OpenRouter)', async () => {
    const mockOpenRouterSuccess = {
      choices: [
        {
          message: {
            content: 'Strategic macroeconomic outlook is stable.',
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockOpenRouterSuccess,
      headers: new Headers(),
    } as any);

    const result = await executeWithFallback({
      systemPrompt: 'You are a quant strategist.',
      userPrompt: 'Analyze SPX trends.',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('openrouter');
    expect(result.content).toBe('Strategic macroeconomic outlook is stable.');
    expect(result.fallbackTriggered).toBe(false);
    expect(result.attempts.length).toBe(1);
    expect(result.attempts[0].status).toBe('success');
  });

  it('catches HTTP 429 rate limit on OpenRouter and seamlessly falls back to Google AI Studio', async () => {
    const mockGeminiSuccess = {
      choices: [
        {
          message: {
            content: 'Google AI Studio completed the macro tactical review.',
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // 1. OpenRouter returns 429
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded: free tier quota exhausted',
        headers: new Headers({ 'retry-after': '60' }),
      } as any)
      // 2. Google AI Studio returns 200
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGeminiSuccess,
        headers: new Headers(),
      } as any);

    const result = await executeWithFallback({
      userPrompt: 'Review risk exposure.',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.provider).toBe('google-ai-studio');
    expect(result.content).toBe('Google AI Studio completed the macro tactical review.');
    expect(result.fallbackTriggered).toBe(true);
    expect(result.attempts.length).toBe(2);
    expect(result.attempts[0].provider).toBe('openrouter');
    expect(result.attempts[0].status).toBe('rate_limit_429');
    expect(result.attempts[1].provider).toBe('google-ai-studio');
    expect(result.attempts[1].status).toBe('success');
  });

  it('skips throttled provider during cooldown window without making redundant HTTP calls', async () => {
    // 1. First trigger a 429 on OpenRouter
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
        headers: new Headers({ 'retry-after': '120' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'From Google' } }] }),
        headers: new Headers(),
      } as any);

    await executeWithFallback({ userPrompt: 'Call 1' });

    expect(circuitBreaker.isCoolingDown('openrouter')).toBe(true);

    // 2. Second request immediately follows:
    // OpenRouter MUST be skipped because it is cooling down!
    const fetchSpy2 = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'From Google directly' } }] }),
      headers: new Headers(),
    } as any);

    const result2 = await executeWithFallback({ userPrompt: 'Call 2' });

    // Should only have called Google AI Studio once! OpenRouter was skipped via circuit breaker!
    expect(fetchSpy2).toHaveBeenCalledTimes(1);
    expect(result2.provider).toBe('google-ai-studio');
    expect(result2.attempts[0].provider).toBe('openrouter');
    expect(result2.attempts[0].status).toBe('skipped_cooldown');
    expect(result2.attempts[1].provider).toBe('google-ai-studio');
    expect(result2.attempts[1].status).toBe('success');
  });

  it('falls back across 3 tiers: OpenRouter (5xx) -> Google AI Studio (5xx) -> Groq (200 Success)', async () => {
    const mockGroqSuccess = {
      choices: [
        {
          message: {
            content: 'Groq ultra-fast LPU inference completed successfully.',
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // OpenRouter attempt 1: 500
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
        headers: new Headers(),
      } as any)
      // OpenRouter retry 1: 500
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error (persistent)',
        headers: new Headers(),
      } as any)
      // Google AI Studio attempt 1: 503
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
        headers: new Headers(),
      } as any)
      // Google AI Studio retry 1: 503
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable (persistent)',
        headers: new Headers(),
      } as any)
      // Groq attempt 1: 200
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGroqSuccess,
        headers: new Headers(),
      } as any);

    const result = await executeWithFallback({
      userPrompt: 'Calculate portfolio Greeks.',
    });

    expect(result.provider).toBe('groq');
    expect(result.content).toBe('Groq ultra-fast LPU inference completed successfully.');
    expect(result.fallbackTriggered).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it('correctly handles JSON mode and cleans markdown code fences', async () => {
    const rawFencedResponse = '```json\n{\n  "verdict": "STRONG_BUY",\n  "confidence": 0.88,\n  "targetPrice": 142.5\n}\n```';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: rawFencedResponse } }],
      }),
      headers: new Headers(),
    } as any);

    interface TradeVerdict {
      verdict: string;
      confidence: number;
      targetPrice: number;
    }

    const result = await generateJsonCompletion<TradeVerdict>({
      userPrompt: 'Evaluate breakout probability.',
    });

    expect(result.data).toBeDefined();
    expect(result.data?.verdict).toBe('STRONG_BUY');
    expect(result.data?.confidence).toBe(0.88);
    expect(result.data?.targetPrice).toBe(142.5);
  });

  it('sanitizes embedded JSON responses with leading or trailing conversational text', () => {
    const dirtyOutput = 'Sure! Here is the JSON evaluation:\n\n```json\n{"score": 92, "rating": "A+"}\n```\nHope this helps!';
    const parsed = sanitizeJsonResponse(dirtyOutput);
    expect(parsed).toEqual({ score: 92, rating: 'A+' });
  });

  it('throws descriptive error detailing all provider failures if cascade is completely exhausted', async () => {
    vi.spyOn(globalThis, 'fetch')
      // OpenRouter
      .mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Exhausted',
        headers: new Headers(),
      } as any);

    await expect(
      executeWithFallback({
        userPrompt: 'Test all down',
        preferredProviders: ['openrouter'],
      })
    ).rejects.toThrow(/All LLM providers failed in fallback cascade/);
  });

  it('gracefully skips unconfigured providers when API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY; // Missing primary key

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Executed via Google AI Studio directly.' } }],
      }),
      headers: new Headers(),
    } as any);

    const result = await executeWithFallback({
      userPrompt: 'Test missing key.',
    });

    expect(result.provider).toBe('google-ai-studio');
    expect(result.attempts[0].provider).toBe('openrouter');
    expect(result.attempts[0].status).toBe('missing_key');
    expect(result.attempts[1].provider).toBe('google-ai-studio');
    expect(result.attempts[1].status).toBe('success');
  });

  it('allows manual reset of circuit breaker cooldowns', async () => {
    // Force a 429
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Throttled',
      headers: new Headers({ 'retry-after': '600' }),
    } as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'Secondary' } }] }),
      headers: new Headers(),
    } as any);

    await executeWithFallback({ userPrompt: 'Throttle test' });
    expect(circuitBreaker.isCoolingDown('openrouter')).toBe(true);

    // Reset cooldowns
    resetFallbackRouterCooldowns('openrouter');
    expect(circuitBreaker.isCoolingDown('openrouter')).toBe(false);
  });

  it('generateTextCompletion returns plain string directly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Direct text output.' } }],
      }),
      headers: new Headers(),
    } as any);

    const text = await generateTextCompletion({
      userPrompt: 'Tell me a fact.',
    });

    expect(text).toBe('Direct text output.');
  });

  it('accurately reports provider telemetry and statistics', () => {
    const stats = getFallbackRouterStats();
    expect(stats.providers.openrouter).toBeDefined();
    expect(stats.providers['google-ai-studio']).toBeDefined();
    expect(stats.providers.groq).toBeDefined();
    expect(stats.cascadeOrder).toEqual(['openrouter', 'google-ai-studio', 'groq', 'cloudflare']);
  });
});

