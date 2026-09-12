import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HybridAgentCopilot, COPILOT_MODELS } from '../components/HybridAgentCopilot';
import { CopilotPrintModal } from '../components/CopilotPrintModal';
import * as thoughtLogService from '../services/thoughtLogService';

describe('AI Copilot Enhancements', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders all AI models in model selector and persists choice to localStorage', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HybridAgentCopilot isOpen={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );

    const selectEl = screen.getByRole('combobox', { name: /select ai model/i }) as HTMLSelectElement;
    expect(selectEl).toBeDefined();
    expect(selectEl.value).toBe('auto');

    // Verify model options are present
    expect(screen.getByText(/Auto Hybrid/i)).toBeDefined();
    expect(screen.getByText(/Ling 3.0 Flash Finance/i)).toBeDefined();
    expect(screen.getByText(/Llama 3.3 70B/i)).toBeDefined();
    expect(screen.getByText(/Gemini 2.0 Flash/i)).toBeDefined();
    expect(screen.getAllByText(/Ollama/i).length).toBeGreaterThanOrEqual(1);

    // Change model
    fireEvent.change(selectEl, { target: { value: 'inclusionai/ling-3.0-flash-fin:free' } });
    expect(selectEl.value).toBe('inclusionai/ling-3.0-flash-fin:free');
    expect(localStorage.getItem('tradeflow_copilot_model')).toBe('inclusionai/ling-3.0-flash-fin:free');
  });

  it('toggles fullscreen mode when maximize button is clicked', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <HybridAgentCopilot isOpen={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );

    const fullscreenButton = screen.getByTitle('Open chat in full size');
    expect(fullscreenButton).toBeDefined();

    // Click to enter fullscreen
    fireEvent.click(fullscreenButton);

    // Button title changes to restore
    expect(screen.getByTitle('Restore side sheet view')).toBeDefined();

    // Check that sheet has full size classes
    const dialogContent = document.querySelector('[role="dialog"]');
    expect(dialogContent?.className).toContain('!w-screen');
    expect(dialogContent?.className).toContain('!h-screen');

    // Click to restore
    fireEvent.click(screen.getByTitle('Restore side sheet view'));
    expect(screen.getByTitle('Open chat in full size')).toBeDefined();
  });

  it('renders CopilotPrintModal with stylized layout and calls window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <CopilotPrintModal
        isOpen={true}
        onClose={vi.fn()}
        data={{
          id: 'test-msg-1',
          query: 'What is the DCF valuation of Apple?',
          response: '### Valuation Analysis\n\nApple has a median intrinsic fair value of **$264.00**.',
          model: 'Ling 3.0 Flash Finance',
          classification: 'complex_analysis',
          executionTime: 1.45,
          timestamp: '10:30 AM'
        }}
      />
    );

    // Verify header and document structure
    expect(screen.getByText(/Executive Research Memo/i)).toBeDefined();
    expect(screen.getByText(/What is the DCF valuation of Apple\?/i)).toBeDefined();
    expect(screen.getByText(/Model: Ling 3.0 Flash Finance/i)).toBeDefined();
    expect(screen.getByText(/Remote Synthesis \(OpenRouter\)/i)).toBeDefined();
    expect(screen.getByText(/Apple has a median intrinsic fair value of/i)).toBeDefined();

    // Verify print button triggers window.print()
    const printButton = screen.getByRole('button', { name: /Print \/ Save PDF/i });
    fireEvent.click(printButton);
    expect(printSpy).toHaveBeenCalled();
  });

  it('saves an answer to Log in folder "Saved" with question and model metadata', async () => {
    const createThoughtLogSpy = vi.spyOn(thoughtLogService, 'createThoughtLog').mockResolvedValue({
      id: 'saved-note-1',
      title: 'Copilot: NVDA valuation check',
      content: 'Sample content',
      folder: 'Saved',
      tags: 'AI Copilot, Saved Answer',
      sentiment: 'NEUTRAL',
      isPinned: false,
      agentOutput: 'NVDA analysis',
      agentActionType: 'COPILOT_SAVED',
      agentHistory: null,
      marketDataJson: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'NVDA is trading at 32x trailing earnings with 45% operating margins.',
        model: 'Ling 3.0 Flash Finance',
        classification: 'complex_analysis',
        router_reasoning: 'Multi-factor valuation check',
        tools_used: ['market_data_tool'],
        execution_time_seconds: 1.2
      })
    });
    global.fetch = mockFetch;

    render(
      <QueryClientProvider client={queryClient}>
        <HybridAgentCopilot isOpen={true} onOpenChange={vi.fn()} onNavigateToLog={vi.fn()} />
      </QueryClientProvider>
    );

    // Send query
    const input = screen.getByPlaceholderText(/Ask financial question/i);
    fireEvent.change(input, { target: { value: 'NVDA valuation check' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    // Wait for agent answer to appear
    await waitFor(() => {
      expect(screen.getByText(/NVDA is trading at 32x trailing earnings/i)).toBeDefined();
    });

    // Verify actions exist on the agent message: Copy, Print / PDF, Save to Log
    expect(screen.getByText('Print / PDF')).toBeDefined();
    const saveToLogBtn = screen.getByTitle(/Save this answer to 'Saved' folder/i);
    expect(saveToLogBtn).toBeDefined();

    // Click Save to Log
    fireEvent.click(saveToLogBtn);

    await waitFor(() => {
      expect(createThoughtLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'Saved',
          tags: expect.stringContaining('Saved Answer'),
          agentActionType: 'COPILOT_SAVED'
        })
      );
    });

    // Badge updates to "Saved in Log"
    expect(screen.getByText('Saved in Log')).toBeDefined();
  });

  it('renders "Saved" folder capsule in LogPage and respects initialFolder="Saved"', async () => {
    const { LogPage } = await import('../components/LogPage');

    vi.spyOn(thoughtLogService, 'useThoughtLogs').mockReturnValue({
      data: [
        {
          id: 'log-1',
          title: 'Copilot: NVDA DCF Summary',
          content: 'NVDA analysis content',
          folder: 'Saved',
          tags: 'AI Copilot, Saved Answer',
          sentiment: 'NEUTRAL',
          isPinned: false,
          agentOutput: 'NVDA analysis',
          agentActionType: 'COPILOT_SAVED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any
      ],
      isLoading: false,
    } as any);

    vi.spyOn(thoughtLogService, 'useThoughtLogFolders').mockReturnValue({
      data: {
        totalCount: 1,
        unfiledCount: 0,
        telegramCount: 0,
        voiceCount: 0,
        folders: [{ name: 'Saved', count: 1 }],
      },
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <LogPage initialFolder="Saved" />
      </QueryClientProvider>
    );

    // Verify Saved folder capsule exists in the folder list
    expect(screen.getAllByText('Saved').length).toBeGreaterThanOrEqual(1);

    // Verify saved note is rendered
    expect(screen.getByText('Copilot: NVDA DCF Summary')).toBeDefined();
  });
});
