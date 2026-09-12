import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  circuitBreaker,
  getProviderAllowances,
  resetFallbackRouterCooldowns,
} from '../../server/services/llmFallbackRouter';
import { AgentActivityDrawer } from '../components/AgentActivityDrawer';
import * as agentActivityService from '../services/agentActivityService';
import * as llmAllowancesService from '../services/llmAllowancesService';

describe('Agent Activity LLM Allowances & Quota Telemetry', () => {
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

  it('generates a comprehensive allowances report for all major LLM providers', async () => {
    const report = await getProviderAllowances();

    expect(report).toBeDefined();
    expect(report.providers.length).toBeGreaterThanOrEqual(4);

    const openrouter = report.providers.find((p) => p.providerId === 'openrouter');
    const gemini = report.providers.find((p) => p.providerId === 'google-ai-studio');
    const groq = report.providers.find((p) => p.providerId === 'groq');
    const ollama = report.providers.find((p) => p.providerId === 'ollama');

    expect(openrouter).toBeDefined();
    expect(openrouter?.name).toBe('OpenRouter');
    expect(openrouter?.hasKey).toBe(true);
    expect(openrouter?.rateLimits.rpm).toBe(20);

    expect(gemini).toBeDefined();
    expect(gemini?.name).toBe('Google AI Studio (Gemini)');
    expect(gemini?.totalQuota).toBe(1500);
    expect(gemini?.rateLimits.rpm).toBe(15);
    expect(gemini?.rateLimits.rpd).toBe(1500);
    expect(gemini?.unitLabel).toBe('Requests Today');

    expect(groq).toBeDefined();
    expect(groq?.name).toBe('Groq (LPUs)');
    expect(groq?.totalQuota).toBe(14400);
    expect(groq?.rateLimits.rpm).toBe(30);
    expect(groq?.rateLimits.rpd).toBe(14400);

    expect(ollama).toBeDefined();
    expect(ollama?.tier).toBe('Local Offline');
    expect(ollama?.quotaType).toBe('unlimited');
  });

  it('updates consumption counts when requests succeed and reflects remaining quota', async () => {
    // Record mock successful calls
    circuitBreaker.recordSuccess('google-ai-studio');
    circuitBreaker.recordSuccess('google-ai-studio');
    circuitBreaker.recordSuccess('groq');

    const report = await getProviderAllowances();
    const gemini = report.providers.find((p) => p.providerId === 'google-ai-studio')!;
    const groq = report.providers.find((p) => p.providerId === 'groq')!;

    expect(gemini.consumed).toBe(2);
    expect(gemini.remaining).toBe(1498);
    expect(gemini.requestsToday).toBe(2);

    expect(groq.consumed).toBe(1);
    expect(groq.remaining).toBe(14399);
    expect(groq.requestsToday).toBe(1);
    expect(report.totalCallsToday).toBe(3);
  });

  it('renders allowances tab and provider metrics in AgentActivityDrawer', async () => {
    const mockAllowancesReport: llmAllowancesService.LLMAllowancesReport = {
      timestamp: new Date().toISOString(),
      totalCallsToday: 42,
      activeCascade: ['openrouter', 'google-ai-studio', 'groq', 'ollama'],
      providers: [
        {
          providerId: 'openrouter',
          name: 'OpenRouter',
          hasKey: true,
          tier: 'Free Tier',
          isAvailable: true,
          isCoolingDown: false,
          cooldownRemainingSeconds: 0,
          quotaType: 'requests_daily',
          totalQuota: 200,
          consumed: 12,
          remaining: 188,
          percentRemaining: 94,
          unitLabel: 'Daily Free Req',
          rateLimits: { rpm: 20, rpd: 200, resetText: '20 RPM / 200 RPD' },
          activeModel: 'inclusionai/ling-3.0-flash-fin:free',
          totalCalls: 12,
          successfulCalls: 12,
          requestsToday: 12,
          notes: 'Active Free Tier.',
        },
        {
          providerId: 'google-ai-studio',
          name: 'Google AI Studio (Gemini)',
          hasKey: true,
          tier: 'Free Tier',
          isAvailable: true,
          isCoolingDown: false,
          cooldownRemainingSeconds: 0,
          quotaType: 'requests_daily',
          totalQuota: 1500,
          consumed: 25,
          remaining: 1475,
          percentRemaining: 98,
          unitLabel: 'Requests Today',
          rateLimits: { rpm: 15, rpd: 1500, tpm: 1000000 },
          activeModel: 'gemini-flash-latest',
          totalCalls: 25,
          successfulCalls: 25,
          requestsToday: 25,
          notes: 'Free Tier: 1,500 requests/day & 15 RPM.',
        },
        {
          providerId: 'groq',
          name: 'Groq (LPUs)',
          hasKey: true,
          tier: 'Free Tier',
          isAvailable: true,
          isCoolingDown: false,
          cooldownRemainingSeconds: 0,
          quotaType: 'requests_daily',
          totalQuota: 14400,
          consumed: 5,
          remaining: 14395,
          percentRemaining: 100,
          unitLabel: 'Requests Today',
          rateLimits: { rpm: 30, rpd: 14400 },
          activeModel: 'openai/gpt-oss-20b',
          totalCalls: 5,
          successfulCalls: 5,
          requestsToday: 5,
        },
        {
          providerId: 'ollama',
          name: 'Ollama (Local Offline)',
          hasKey: true,
          tier: 'Local Offline',
          isAvailable: true,
          isCoolingDown: false,
          cooldownRemainingSeconds: 0,
          quotaType: 'unlimited',
          totalQuota: null,
          consumed: 0,
          remaining: null,
          percentRemaining: 100,
          unitLabel: 'Local Inferences',
          rateLimits: {},
          activeModel: 'deepseek-r1:8b',
          totalCalls: 0,
          successfulCalls: 0,
          requestsToday: 0,
        },
      ],
    };

    vi.spyOn(llmAllowancesService, 'useLLMAllowances').mockReturnValue({
      data: mockAllowancesReport,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(agentActivityService, 'useAgentActivities').mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AgentActivityDrawer isOpen={true} onClose={() => {}} />
      </QueryClientProvider>
    );

    // Verify Title and Tabs
    expect(screen.getByText('AI Agent Activity & Allowances')).toBeDefined();
    expect(screen.getByText('Model Allowances & Quotas')).toBeDefined();
    expect(screen.getByText('Execution Telemetry Log')).toBeDefined();

    // Verify Provider names are rendered
    expect(screen.getByText('OpenRouter')).toBeDefined();
    expect(screen.getByText('Google AI Studio (Gemini)')).toBeDefined();
    expect(screen.getByText('Groq (LPUs)')).toBeDefined();
    expect(screen.getByText('Ollama (Local Offline)')).toBeDefined();

    // Verify remaining allowances are displayed
    expect(screen.getByText('1,475 left today')).toBeDefined();
    expect(screen.getByText('14,395 left today')).toBeDefined();
    expect(screen.getByText('Unlimited (Local)')).toBeDefined();

    // Switch to Activity Log tab
    const activityTabTrigger = screen.getByRole('tab', { name: /Execution Telemetry Log/i });
    fireEvent.pointerDown(activityTabTrigger, { button: 0 });
    fireEvent.click(activityTabTrigger);
    fireEvent.keyDown(activityTabTrigger, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('No Agent Activity Logged Yet')).toBeDefined();
    });
  });
});
