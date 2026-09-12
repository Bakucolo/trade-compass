/**
 * Multi-Tier Robust LLM API Fallback Router
 * 
 * Maximizes free-tier allowances and ensures high-availability for complex AI tasks:
 * 1. Primary:   OpenRouter (meta-llama/llama-3.3-70b-instruct:free, deepseek-r1:free, gpt-4o-mini)
 * 2. Secondary: Google AI Studio (Gemini 2.0 Flash / 1.5 Flash via OpenAI endpoint or native REST)
 * 3. Tertiary:  Groq (llama-3.3-70b-versatile / llama-3.1-8b-instant)
 * 4. Quaternary (Optional): Cloudflare Workers AI (@cf/meta/llama-3.3-70b-instruct)
 * 
 * Features:
 * - Seamless 429 (Rate Limit) detection with Retry-After header parsing & circuit breaker cooldown memory.
 * - Seamless 5xx (Server Error) detection with transient retry + exponential backoff + failover.
 * - Circuit breaker: skips throttled providers immediately without burning latency on known-failing endpoints.
 * - Normalizes input/output across providers with automatic JSON fence stripping and schema validation.
 */

export type ProviderId = 'openrouter' | 'google-ai-studio' | 'groq' | 'cloudflare';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  /** Chat messages array */
  messages?: ChatMessage[];
  /** Convenience shortcut for system prompt */
  systemPrompt?: string;
  /** Convenience shortcut for user prompt */
  userPrompt?: string;
  /** When true, prompts and configures the LLM for valid JSON output */
  jsonMode?: boolean;
  /** Sampling temperature (0.0 to 1.0) */
  temperature?: number;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Milliseconds before aborting an attempt (default: 35000ms) */
  timeoutMs?: number;
  /** Override default provider fallback order */
  preferredProviders?: ProviderId[];
  /** Specific model overrides per provider (e.g. { openrouter: 'openai/gpt-4o-mini' }) */
  modelOverrides?: Partial<Record<ProviderId, string>>;
  /** Logging tag for tracing and debugging */
  tag?: string;
}

export type AttemptStatus = 
  | 'success'
  | 'rate_limit_429'
  | 'server_error_5xx'
  | 'timeout'
  | 'auth_error_401'
  | 'skipped_cooldown'
  | 'missing_key'
  | 'network_error'
  | 'parse_error';

export interface LLMAttemptLog {
  provider: ProviderId;
  model: string;
  status: AttemptStatus;
  statusCode?: number;
  error?: string;
  latencyMs: number;
  retryCount?: number;
}

export interface LLMCompletionResult<T = any> {
  content: string;
  data?: T;
  provider: ProviderId;
  model: string;
  latencyMs: number;
  fallbackTriggered: boolean;
  attempts: LLMAttemptLog[];
}

export interface ProviderState {
  provider: ProviderId;
  isAvailable: boolean;
  isCoolingDown: boolean;
  cooldownUntil: number | null;
  cooldownRemainingSeconds: number;
  consecutiveFailures: number;
  totalCalls: number;
  successfulCalls: number;
  lastError?: string;
  lastUsedAt?: string;
}

export interface FallbackRouterStats {
  providers: Record<ProviderId, ProviderState>;
  cascadeOrder: ProviderId[];
  timestamp: string;
}

export interface ProviderAllowance {
  providerId: ProviderId | 'ollama';
  name: string;
  hasKey: boolean;
  tier: 'Free Tier' | 'Credit Balance' | 'Local Offline';
  isAvailable: boolean;
  isCoolingDown: boolean;
  cooldownRemainingSeconds: number;
  quotaType: 'usd' | 'requests_daily' | 'unlimited';
  totalQuota: number | null;
  consumed: number;
  remaining: number | null;
  percentRemaining: number;
  unitLabel: string;
  rateLimits: {
    rpm?: number;
    rpd?: number;
    tpm?: number;
    resetText?: string;
  };
  activeModel: string;
  totalCalls: number;
  successfulCalls: number;
  requestsToday: number;
  lastUsedAt?: string;
  notes?: string;
}

export interface LLMAllowancesReport {
  timestamp: string;
  totalCallsToday: number;
  activeCascade: string[];
  providers: ProviderAllowance[];
}

// Default models optimized for quality + free-tier allowances
export const DEFAULT_PROVIDER_MODELS: Record<ProviderId, string> = {
  openrouter: process.env.OPENROUTER_MODEL || 'inclusionai/ling-3.0-flash-fin:free',
  'google-ai-studio': process.env.GEMINI_MODEL || 'gemini-flash-latest',
  groq: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  cloudflare: process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.3-70b-instruct',
};

// Fallback cascade ordering
export const DEFAULT_PROVIDER_CASCADE: ProviderId[] = [
  'openrouter',
  'google-ai-studio',
  'groq',
  'cloudflare',
];

interface OpenRouterCacheData {
  totalUsage: number;
  totalCredits: number;
  isFreeTier: boolean;
  limit: number | null;
  timestamp: number;
}
let openRouterCache: OpenRouterCacheData | null = null;

async function fetchOpenRouterLiveQuota(apiKey: string): Promise<OpenRouterCacheData | null> {
  if (openRouterCache && Date.now() - openRouterCache.timestamp < 30_000) {
    return openRouterCache;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const [keyRes, creditsRes] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal
      }).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);
    clearTimeout(timeout);

    const totalUsage = creditsRes?.data?.total_usage ?? keyRes?.data?.usage ?? 0;
    const totalCredits = creditsRes?.data?.total_credits ?? 0;
    const isFreeTier = Boolean(keyRes?.data?.is_free_tier || totalCredits === 0);
    const limit = keyRes?.data?.limit ?? null;

    openRouterCache = {
      totalUsage,
      totalCredits,
      isFreeTier,
      limit,
      timestamp: Date.now()
    };
    return openRouterCache;
  } catch (err) {
    console.error('[OpenRouter Quota] Error querying OpenRouter allowances:', err);
    return openRouterCache;
  }
}

/**
 * In-memory Circuit Breaker & Cooldown Manager
 */
class ProviderCooldownManager {
  private states = new Map<ProviderId | 'ollama', {
    cooldownUntil: number;
    consecutiveFailures: number;
    totalCalls: number;
    successfulCalls: number;
    requestsToday: number;
    lastError?: string;
    lastUsedAt?: number;
  }>();
  private currentDate = new Date().toISOString().split('T')[0];

  constructor() {
    for (const p of DEFAULT_PROVIDER_CASCADE) {
      this.states.set(p, {
        cooldownUntil: 0,
        consecutiveFailures: 0,
        totalCalls: 0,
        successfulCalls: 0,
        requestsToday: 0,
      });
    }
    this.states.set('ollama' as any, {
      cooldownUntil: 0,
      consecutiveFailures: 0,
      totalCalls: 0,
      successfulCalls: 0,
      requestsToday: 0,
    });
  }

  private checkDateRoll(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.currentDate) {
      this.currentDate = today;
      for (const state of this.states.values()) {
        state.requestsToday = 0;
      }
    }
  }

  public isAvailable(provider: ProviderId): boolean {
    const key = this.getApiKey(provider);
    if (!key) return false;

    const state = this.states.get(provider);
    if (!state) return true;

    // If cooldown has expired, provider is considered available (half-open test)
    return Date.now() >= state.cooldownUntil;
  }

  public isCoolingDown(provider: ProviderId): boolean {
    const state = this.states.get(provider);
    if (!state) return false;
    return Date.now() < state.cooldownUntil;
  }

  public getCooldownRemainingSeconds(provider: ProviderId): number {
    const state = this.states.get(provider);
    if (!state || Date.now() >= state.cooldownUntil) return 0;
    return Math.ceil((state.cooldownUntil - Date.now()) / 1000);
  }

  public getApiKey(provider: ProviderId): string | null {
    switch (provider) {
      case 'openrouter':
        return process.env.OPENROUTER_API_KEY || null;
      case 'google-ai-studio':
        return process.env.GEMINI_API_KEY || null;
      case 'groq':
        return process.env.GROQ_API_KEY || null;
      case 'cloudflare':
        return (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID)
          ? process.env.CLOUDFLARE_API_TOKEN
          : null;
      default:
        return null;
    }
  }

  public recordSuccess(provider: ProviderId): void {
    this.checkDateRoll();
    const state = this.states.get(provider);
    if (state) {
      state.cooldownUntil = 0;
      state.consecutiveFailures = 0;
      state.totalCalls += 1;
      state.successfulCalls += 1;
      state.requestsToday = (state.requestsToday || 0) + 1;
      state.lastUsedAt = Date.now();
      delete state.lastError;
    }
  }

  public recordFailure(
    provider: ProviderId,
    status: number,
    retryAfterSeconds?: number,
    errorMsg?: string
  ): void {
    this.checkDateRoll();
    let state = this.states.get(provider);
    if (!state) {
      state = {
        cooldownUntil: 0,
        consecutiveFailures: 0,
        totalCalls: 0,
        successfulCalls: 0,
        requestsToday: 0,
      };
      this.states.set(provider, state);
    }

    state.totalCalls += 1;
    state.requestsToday = (state.requestsToday || 0) + 1;
    state.consecutiveFailures += 1;
    state.lastError = errorMsg;
    state.lastUsedAt = Date.now();

    // Determine cooldown length
    let cooldownMs = 60_000; // Default 60s

    if (retryAfterSeconds && retryAfterSeconds > 0) {
      cooldownMs = retryAfterSeconds * 1000;
    } else if (status === 429) {
      // Exponential penalty for recurring rate limits: 60s, 120s, 240s, 480s max
      const multiplier = Math.min(Math.pow(2, state.consecutiveFailures - 1), 8);
      cooldownMs = 60_000 * multiplier;
    } else if (status >= 500 && status < 600) {
      // 5xx server downtime: brief 30s cooldown
      cooldownMs = 30_000;
    } else if (status === 401 || status === 403) {
      // Bad credentials: long 10m cooldown
      cooldownMs = 600_000;
    }

    state.cooldownUntil = Date.now() + cooldownMs;
  }

  public reset(provider?: ProviderId): void {
    if (provider) {
      const state = this.states.get(provider);
      if (state) {
        state.cooldownUntil = 0;
        state.consecutiveFailures = 0;
      }
    } else {
      for (const state of this.states.values()) {
        state.cooldownUntil = 0;
        state.consecutiveFailures = 0;
      }
    }
  }

  public getStats(): FallbackRouterStats {
    const providers: Record<ProviderId, ProviderState> = {} as any;
    for (const p of DEFAULT_PROVIDER_CASCADE) {
      const state = this.states.get(p) || {
        cooldownUntil: 0,
        consecutiveFailures: 0,
        totalCalls: 0,
        successfulCalls: 0,
        requestsToday: 0,
      };
      const hasKey = Boolean(this.getApiKey(p));
      const isCooling = Date.now() < state.cooldownUntil;

      providers[p] = {
        provider: p,
        isAvailable: hasKey && !isCooling,
        isCoolingDown: isCooling,
        cooldownUntil: state.cooldownUntil > 0 ? state.cooldownUntil : null,
        cooldownRemainingSeconds: this.getCooldownRemainingSeconds(p),
        consecutiveFailures: state.consecutiveFailures,
        totalCalls: state.totalCalls,
        successfulCalls: state.successfulCalls,
        lastError: state.lastError,
        lastUsedAt: state.lastUsedAt ? new Date(state.lastUsedAt).toISOString() : undefined,
      };
    }

    return {
      providers,
      cascadeOrder: DEFAULT_PROVIDER_CASCADE,
      timestamp: new Date().toISOString(),
    };
  }

  public async getAllowances(): Promise<LLMAllowancesReport> {
    this.checkDateRoll();
    const allowances: ProviderAllowance[] = [];
    let totalCallsToday = 0;

    // 1. OpenRouter
    const orKey = this.getApiKey('openrouter');
    const orState = this.states.get('openrouter');
    let orQuota: OpenRouterCacheData | null = null;
    if (orKey) {
      orQuota = await fetchOpenRouterLiveQuota(orKey);
    }
    const orUsage = orQuota?.totalUsage ?? 0;
    const orCredits = orQuota?.totalCredits ?? 0;
    const orIsPaid = orCredits > 0;
    const orRemaining = orIsPaid ? Math.max(0, orCredits - orUsage) : null;
    const orPercent = orIsPaid && orCredits > 0
      ? Math.max(0, Math.min(100, Math.round((orRemaining! / orCredits) * 100)))
      : 100;
    const orReqToday = orState?.requestsToday || 0;
    totalCallsToday += orReqToday;

    allowances.push({
      providerId: 'openrouter',
      name: 'OpenRouter',
      hasKey: Boolean(orKey),
      tier: orIsPaid ? 'Credit Balance' : 'Free Tier',
      isAvailable: this.isAvailable('openrouter'),
      isCoolingDown: this.isCoolingDown('openrouter'),
      cooldownRemainingSeconds: this.getCooldownRemainingSeconds('openrouter'),
      quotaType: orIsPaid ? 'usd' : 'requests_daily',
      totalQuota: orIsPaid ? orCredits : 200,
      consumed: orUsage,
      remaining: orRemaining !== null ? orRemaining : Math.max(0, 200 - orReqToday),
      percentRemaining: orPercent,
      unitLabel: orIsPaid ? 'USD ($)' : 'Daily Free Req',
      rateLimits: {
        rpm: 20,
        rpd: 200,
        resetText: '20 RPM / 200 RPD on free tier',
      },
      activeModel: DEFAULT_PROVIDER_MODELS.openrouter,
      totalCalls: orState?.totalCalls || 0,
      successfulCalls: orState?.successfulCalls || 0,
      requestsToday: orReqToday,
      lastUsedAt: orState?.lastUsedAt ? new Date(orState.lastUsedAt).toISOString() : undefined,
      notes: orIsPaid
        ? `Credit Balance: $${orRemaining?.toFixed(4)} left of $${orCredits.toFixed(2)}.`
        : 'Active Free Tier. Unlimited access to :free models with 20 RPM rate limit.',
    });

    // 2. Google AI Studio (Gemini)
    const geminiKey = this.getApiKey('google-ai-studio');
    const geminiState = this.states.get('google-ai-studio');
    const geminiReqToday = geminiState?.requestsToday || 0;
    const geminiRemaining = Math.max(0, 1500 - geminiReqToday);
    const geminiPercent = Math.max(0, Math.min(100, Math.round((geminiRemaining / 1500) * 100)));
    totalCallsToday += geminiReqToday;

    allowances.push({
      providerId: 'google-ai-studio',
      name: 'Google AI Studio (Gemini)',
      hasKey: Boolean(geminiKey),
      tier: 'Free Tier',
      isAvailable: this.isAvailable('google-ai-studio'),
      isCoolingDown: this.isCoolingDown('google-ai-studio'),
      cooldownRemainingSeconds: this.getCooldownRemainingSeconds('google-ai-studio'),
      quotaType: 'requests_daily',
      totalQuota: 1500,
      consumed: geminiReqToday,
      remaining: geminiRemaining,
      percentRemaining: geminiPercent,
      unitLabel: 'Requests Today',
      rateLimits: {
        rpm: 15,
        rpd: 1500,
        tpm: 1000000,
        resetText: 'Resets daily at 00:00 UTC',
      },
      activeModel: DEFAULT_PROVIDER_MODELS['google-ai-studio'],
      totalCalls: geminiState?.totalCalls || 0,
      successfulCalls: geminiState?.successfulCalls || 0,
      requestsToday: geminiReqToday,
      lastUsedAt: geminiState?.lastUsedAt ? new Date(geminiState.lastUsedAt).toISOString() : undefined,
      notes: 'Free Tier: 1,500 requests/day & 15 RPM for Gemini Flash.',
    });

    // 3. Groq
    const groqKey = this.getApiKey('groq');
    const groqState = this.states.get('groq');
    const groqReqToday = groqState?.requestsToday || 0;
    const groqRemaining = Math.max(0, 14400 - groqReqToday);
    const groqPercent = Math.max(0, Math.min(100, Math.round((groqRemaining / 14400) * 100)));
    totalCallsToday += groqReqToday;

    allowances.push({
      providerId: 'groq',
      name: 'Groq (LPUs)',
      hasKey: Boolean(groqKey),
      tier: 'Free Tier',
      isAvailable: this.isAvailable('groq'),
      isCoolingDown: this.isCoolingDown('groq'),
      cooldownRemainingSeconds: this.getCooldownRemainingSeconds('groq'),
      quotaType: 'requests_daily',
      totalQuota: 14400,
      consumed: groqReqToday,
      remaining: groqRemaining,
      percentRemaining: groqPercent,
      unitLabel: 'Requests Today',
      rateLimits: {
        rpm: 30,
        rpd: 14400,
        tpm: 6000,
        resetText: 'Resets daily at 00:00 UTC',
      },
      activeModel: DEFAULT_PROVIDER_MODELS.groq,
      totalCalls: groqState?.totalCalls || 0,
      successfulCalls: groqState?.successfulCalls || 0,
      requestsToday: groqReqToday,
      lastUsedAt: groqState?.lastUsedAt ? new Date(groqState.lastUsedAt).toISOString() : undefined,
      notes: 'Ultra-fast LPU inference: 14,400 free requests/day & 30 RPM.',
    });

    // 4. Ollama (Local)
    const ollamaState = this.states.get('ollama' as any);
    const ollamaReqToday = ollamaState?.requestsToday || 0;
    totalCallsToday += ollamaReqToday;

    allowances.push({
      providerId: 'ollama' as any,
      name: 'Ollama (Local Offline)',
      hasKey: true,
      tier: 'Local Offline',
      isAvailable: true,
      isCoolingDown: false,
      cooldownRemainingSeconds: 0,
      quotaType: 'unlimited',
      totalQuota: null,
      consumed: ollamaReqToday,
      remaining: null,
      percentRemaining: 100,
      unitLabel: 'Local Inferences',
      rateLimits: {
        resetText: 'Zero cloud rate limits or quotas',
      },
      activeModel: 'llama3.1',
      totalCalls: ollamaState?.totalCalls || 0,
      successfulCalls: ollamaState?.successfulCalls || 0,
      requestsToday: ollamaReqToday,
      lastUsedAt: ollamaState?.lastUsedAt ? new Date(ollamaState.lastUsedAt).toISOString() : undefined,
      notes: '100% private on-device execution. Unlimited inferences with 0 cost.',
    });

    return {
      timestamp: new Date().toISOString(),
      totalCallsToday,
      activeCascade: DEFAULT_PROVIDER_CASCADE,
      providers: allowances,
    };
  }
}

// Global Singleton Circuit Breaker State
export const circuitBreaker = new ProviderCooldownManager();

/**
 * Utility: Parse Retry-After header
 */
function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  // Try integer seconds
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds;
  }
  // Try HTTP Date
  const date = Date.parse(headerValue);
  if (!isNaN(date)) {
    const diff = Math.ceil((date - Date.now()) / 1000);
    return diff > 0 ? diff : 1;
  }
  return undefined;
}

/**
 * Utility: Sanitize and strip markdown code blocks from LLM JSON responses
 */
export function sanitizeJsonResponse<T = any>(rawText: string): T {
  if (!rawText || !rawText.trim()) {
    throw new Error('LLM returned an empty response string.');
  }

  // 1. Strip ```json ... ``` or ``` ... ```
  let cleaned = rawText
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/m, '')
    .trim();

  // 2. Direct parse attempt
  try {
    return JSON.parse(cleaned);
  } catch {
    // 3. Fallback: Find outermost { ... } or [ ... ] bracket span
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = lastBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = lastBracket;
    }

    if (start !== -1 && end !== -1 && end > start) {
      const candidate = cleaned.slice(start, end + 1);
      return JSON.parse(candidate);
    }

    throw new Error(`Failed to parse JSON response from LLM output: ${rawText.slice(0, 200)}...`);
  }
}

/**
 * Helper: Sleep with random jitter for backoff
 */
async function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.floor(Math.random() * 250);
  await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}

/**
 * Normalizes input messages
 */
function normalizeMessages(options: LLMCompletionOptions): ChatMessage[] {
  if (options.messages && options.messages.length > 0) {
    return options.messages;
  }

  const messages: ChatMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  if (options.userPrompt) {
    messages.push({ role: 'user', content: options.userPrompt });
  }

  if (messages.length === 0) {
    throw new Error('No prompt provided. Supply either messages or userPrompt/systemPrompt.');
  }

  return messages;
}

// ============================================================================
// PROVIDER CALL IMPLEMENTATIONS
// ============================================================================

/**
 * Call OpenRouter API
 */
async function callOpenRouter(
  messages: ChatMessage[],
  options: LLMCompletionOptions,
  signal: AbortSignal
): Promise<{ text: string; model: string }> {
  const apiKey = circuitBreaker.getApiKey('openrouter');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const model = options.modelOverrides?.openrouter || DEFAULT_PROVIDER_MODELS.openrouter;

  const payload: any = {
    model,
    messages,
    temperature: options.temperature ?? 0.3,
  };

  if (options.maxTokens) {
    payload.max_tokens = options.maxTokens;
  }

  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://trade-compass.internal',
      'X-Title': 'Trade Compass Quantitative Suite',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    const err: any = new Error(`OpenRouter error ${response.status}: ${errorText}`);
    err.status = response.status;
    err.retryAfter = retryAfter;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { text, model };
}

/**
 * Call Google AI Studio / Gemini API
 * Primary strategy: OpenAI-compatible endpoint.
 * Fallback strategy: Native Google Generative Language REST API.
 */
async function callGoogleAIStudio(
  messages: ChatMessage[],
  options: LLMCompletionOptions,
  signal: AbortSignal
): Promise<{ text: string; model: string }> {
  const apiKey = circuitBreaker.getApiKey('google-ai-studio');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const model = options.modelOverrides?.['google-ai-studio'] || DEFAULT_PROVIDER_MODELS['google-ai-studio'];

  // 1. Try Google's OpenAI-compatible endpoint
  try {
    const payload: any = {
      model,
      messages,
      temperature: options.temperature ?? 0.3,
    };
    if (options.maxTokens) {
      payload.max_tokens = options.maxTokens;
    }
    if (options.jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      return { text, model };
    }

    // If 429 or 5xx, throw immediately so fallback router knows
    if (response.status === 429 || response.status >= 500) {
      const errText = await response.text();
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      const err: any = new Error(`Google AI Studio error ${response.status}: ${errText}`);
      err.status = response.status;
      err.retryAfter = retryAfter;
      throw err;
    }
  } catch (err: any) {
    if (err.status === 429 || (err.status && err.status >= 500)) {
      throw err;
    }
    // If not a rate limit/server error, try native REST API below
  }

  // 2. Secondary fallback: Native Gemini generateContent REST API
  const nativeModel = model.replace(/^models\//, '');
  const nativeUrl = `https://generativelanguage.googleapis.com/v1beta/models/${nativeModel}:generateContent?key=${apiKey}`;

  // Combine system + user messages for native format
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n');
  const combinedPrompt = systemText ? `${systemText}\n\n${userText}` : userText;

  const nativePayload: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: combinedPrompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
      ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
    },
  };

  const nativeResponse = await fetch(nativeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nativePayload),
    signal,
  });

  if (!nativeResponse.ok) {
    const errText = await nativeResponse.text();
    const retryAfter = parseRetryAfter(nativeResponse.headers.get('retry-after'));
    const err: any = new Error(`Google AI Studio Native error ${nativeResponse.status}: ${errText}`);
    err.status = nativeResponse.status;
    err.retryAfter = retryAfter;
    throw err;
  }

  const nativeData = await nativeResponse.json();
  const text = nativeData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text, model: nativeModel };
}

/**
 * Call Groq API
 */
async function callGroq(
  messages: ChatMessage[],
  options: LLMCompletionOptions,
  signal: AbortSignal
): Promise<{ text: string; model: string }> {
  const apiKey = circuitBreaker.getApiKey('groq');
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');

  const model = options.modelOverrides?.groq || DEFAULT_PROVIDER_MODELS.groq;

  const payload: any = {
    model,
    messages,
    temperature: options.temperature ?? 0.3,
  };

  if (options.maxTokens) {
    payload.max_tokens = options.maxTokens;
  }

  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    const err: any = new Error(`Groq error ${response.status}: ${errorText}`);
    err.status = response.status;
    err.retryAfter = retryAfter;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { text, model };
}

/**
 * Call Cloudflare Workers AI API (OpenAI Compatible)
 */
async function callCloudflare(
  messages: ChatMessage[],
  options: LLMCompletionOptions,
  signal: AbortSignal
): Promise<{ text: string; model: string }> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!apiToken || !accountId) {
    throw new Error('CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is not configured');
  }

  const model = options.modelOverrides?.cloudflare || DEFAULT_PROVIDER_MODELS.cloudflare;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;

  const payload: any = {
    model,
    messages,
    temperature: options.temperature ?? 0.3,
  };

  if (options.maxTokens) {
    payload.max_tokens = options.maxTokens;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    const err: any = new Error(`Cloudflare error ${response.status}: ${errorText}`);
    err.status = response.status;
    err.retryAfter = retryAfter;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || data.result?.response || '';
  return { text, model };
}

/**
 * Unified Provider Dispatcher
 */
async function dispatchProviderCall(
  provider: ProviderId,
  messages: ChatMessage[],
  options: LLMCompletionOptions,
  signal: AbortSignal
): Promise<{ text: string; model: string }> {
  switch (provider) {
    case 'openrouter':
      return callOpenRouter(messages, options, signal);
    case 'google-ai-studio':
      return callGoogleAIStudio(messages, options, signal);
    case 'groq':
      return callGroq(messages, options, signal);
    case 'cloudflare':
      return callCloudflare(messages, options, signal);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ============================================================================
// CORE ROUTER EXECUTION ENGINE
// ============================================================================

/**
 * Executes an LLM completion with resilient multi-tier fallback, circuit breaker memory,
 * and transient backoff retries.
 * 
 * @param options Completion request options
 * @returns LLMCompletionResult containing text, parsed JSON (if jsonMode), provider, latency, and full attempt telemetry
 */
export async function executeWithFallback<T = any>(
  options: LLMCompletionOptions
): Promise<LLMCompletionResult<T>> {
  const startTime = Date.now();
  const normalizedMessages = normalizeMessages(options);
  const tag = options.tag ? `[${options.tag}] ` : '';

  // Determine provider sequence
  const cascade = options.preferredProviders && options.preferredProviders.length > 0
    ? options.preferredProviders
    : DEFAULT_PROVIDER_CASCADE;

  const attempts: LLMAttemptLog[] = [];
  const timeoutMs = options.timeoutMs ?? 35_000;

  for (let i = 0; i < cascade.length; i++) {
    const provider = cascade[i];
    const defaultModel = options.modelOverrides?.[provider] || DEFAULT_PROVIDER_MODELS[provider];

    // 1. Check API Key presence
    if (!circuitBreaker.getApiKey(provider)) {
      attempts.push({
        provider,
        model: defaultModel,
        status: 'missing_key',
        error: `API key not configured in environment`,
        latencyMs: 0,
      });
      continue;
    }

    // 2. Check Circuit Breaker / Cooldown status
    if (circuitBreaker.isCoolingDown(provider)) {
      const remainingSec = circuitBreaker.getCooldownRemainingSeconds(provider);
      attempts.push({
        provider,
        model: defaultModel,
        status: 'skipped_cooldown',
        error: `Provider throttled/cooling down for another ${remainingSec}s`,
        latencyMs: 0,
      });
      continue;
    }

    // 3. Attempt Execution on this provider (with 1 retry for transient 5xx)
    let maxRetries = 1; // 1 retry on 5xx errors

    for (let retry = 0; retry <= maxRetries; retry++) {
      const attemptStart = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const result = await dispatchProviderCall(
          provider,
          normalizedMessages,
          options,
          controller.signal
        );

        clearTimeout(timer);
        const latency = Date.now() - attemptStart;

        // Record attempt and circuit breaker success
        circuitBreaker.recordSuccess(provider);
        attempts.push({
          provider,
          model: result.model,
          status: 'success',
          statusCode: 200,
          latencyMs: latency,
          retryCount: retry,
        });

        // Parse JSON if requested
        let parsedData: T | undefined = undefined;
        if (options.jsonMode) {
          try {
            parsedData = sanitizeJsonResponse<T>(result.text);
          } catch (parseErr: any) {
            // If JSON parsing failed, record error and fallback to next provider
            attempts.push({
              provider,
              model: result.model,
              status: 'parse_error',
              error: `JSON parse error: ${parseErr.message}`,
              latencyMs: latency,
            });
            break; // Break retry loop, cascade to next provider
          }
        }

        return {
          content: result.text,
          data: parsedData,
          provider,
          model: result.model,
          latencyMs: Date.now() - startTime,
          fallbackTriggered: i > 0 || retry > 0,
          attempts,
        };
      } catch (err: any) {
        clearTimeout(timer);
        const latency = Date.now() - attemptStart;
        const statusCode = err.status || (err.name === 'AbortError' ? 'timeout' : undefined);
        const retryAfter = err.retryAfter;

        let attemptStatus: AttemptStatus = 'network_error';

        if (err.name === 'AbortError') {
          attemptStatus = 'timeout';
          circuitBreaker.recordFailure(provider, 408, undefined, `Request timed out after ${timeoutMs}ms`);
        } else if (err.status === 429) {
          attemptStatus = 'rate_limit_429';
          circuitBreaker.recordFailure(provider, 429, retryAfter, err.message);
        } else if (err.status >= 500 && err.status < 600) {
          attemptStatus = 'server_error_5xx';
          circuitBreaker.recordFailure(provider, err.status, undefined, err.message);
        } else if (err.status === 401 || err.status === 403) {
          attemptStatus = 'auth_error_401';
          circuitBreaker.recordFailure(provider, err.status, undefined, err.message);
        }

        attempts.push({
          provider,
          model: defaultModel,
          status: attemptStatus,
          statusCode: typeof statusCode === 'number' ? statusCode : undefined,
          error: err.message || String(err),
          latencyMs: latency,
          retryCount: retry,
        });

        // If it's a 5xx error and we haven't retried yet, backoff with jitter and retry once
        if (attemptStatus === 'server_error_5xx' && retry < maxRetries) {
          await sleepWithJitter(500 * (retry + 1));
          continue; // Retry this provider
        }

        // On 429, 401, timeout, or exhausted 5xx retry: failover to next tier immediately
        break;
      }
    }
  }

  // If all providers failed or were unavailable
  const summary = attempts
    .map((a) => `${a.provider}(${a.status}${a.statusCode ? `:${a.statusCode}` : ''})`)
    .join(' -> ');

  const err: any = new Error(
    `${tag}All LLM providers failed in fallback cascade: [${summary}]. Total duration: ${Date.now() - startTime}ms.`
  );
  err.attempts = attempts;
  throw err;
}

/**
 * Convenience Helper: Generates structured JSON output from LLM with fallback
 */
export async function generateJsonCompletion<T = any>(
  options: LLMCompletionOptions
): Promise<LLMCompletionResult<T>> {
  return executeWithFallback<T>({
    ...options,
    jsonMode: true,
  });
}

/**
 * Convenience Helper: Generates plain text/markdown completion with fallback
 */
export async function generateTextCompletion(
  options: LLMCompletionOptions
): Promise<string> {
  const result = await executeWithFallback(options);
  return result.content;
}

/**
 * Expose router statistics for status endpoints and observability
 */
export function getFallbackRouterStats(): FallbackRouterStats {
  return circuitBreaker.getStats();
}

/**
 * Reset cooldowns on providers (e.g. for testing or manual admin reset)
 */
export function resetFallbackRouterCooldowns(provider?: ProviderId): void {
  circuitBreaker.reset(provider);
}

/**
 * Expose provider allowances, quota consumption, and remaining capacities
 */
export async function getProviderAllowances(): Promise<LLMAllowancesReport> {
  return circuitBreaker.getAllowances();
}
