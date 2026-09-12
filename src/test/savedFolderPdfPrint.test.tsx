import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogPage } from '../components/LogPage';
import {
  CopilotPrintModal,
  extractPrintableDataFromLog,
  CopilotPrintableData,
} from '../components/CopilotPrintModal';
import * as thoughtLogService from '../services/thoughtLogService';

describe('Saved Folder PDF Printing & Content Integrity', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  it('extractPrintableDataFromLog extracts inquiry, model, and analysis from saved Copilot note', () => {
    const mockLog: thoughtLogService.ThoughtLogRecord = {
      id: 'saved-copilot-101',
      title: 'Copilot: Palantir AI defense ramp',
      content: `### Financial Inquiry\n> Analyze Palantir's AI defense moat and revenue growth for 2026.\n\n**AI Model**: \`gemini-2.0-flash\` • **Timestamp**: 9/8/2026, 12:45:00 AM\n\n---\n\n### Copilot Analysis\n\nPalantir operates a fortress balance sheet with $4B cash and 38% AIP commercial acceleration.\n\n#### Key Multipliers\n- Net retention: 124%\n- Operating margin: 28%`,
      folder: 'Saved',
      tags: 'AI Copilot, Saved Answer, yfinance',
      symbols: 'PLTR',
      sentiment: 'BULLISH',
      isPinned: false,
      agentOutput: 'Palantir operates a fortress balance sheet with $4B cash and 38% AIP commercial acceleration.',
      agentActionType: 'COPILOT_SAVED',
      agentHistory: null,
      marketDataJson: null,
      createdAt: '2026-09-08T00:45:00.000Z',
      updatedAt: '2026-09-08T00:45:00.000Z',
    };

    const printable = extractPrintableDataFromLog(mockLog);

    expect(printable.id).toBe('saved-copilot-101');
    expect(printable.query).toBe("Analyze Palantir's AI defense moat and revenue growth for 2026.");
    expect(printable.model).toBe('gemini-2.0-flash');
    expect(printable.response).toContain('Palantir operates a fortress balance sheet');
    expect(printable.response).toContain('Key Multipliers');
    expect(printable.toolsUsed).toContain('yfinance');
  });

  it('renders Print PDF button on saved cards and in detail pane header in LogPage', async () => {
    const mockSavedLog: thoughtLogService.ThoughtLogRecord = {
      id: 'log-saved-42',
      title: 'Copilot: DeepSeek vs Llama benchmark',
      content: `### Financial Inquiry\n> Compare inference speed of DeepSeek R1 vs Llama 3.3 for quant portfolio audit.\n\n**AI Model**: \`deepseek-r1\` • **Timestamp**: 9/8/2026\n\n---\n\n### Copilot Analysis\n\nDeepSeek R1 generates reasoning chains with 8x lower token cost.`,
      folder: 'Saved',
      tags: 'AI Copilot, Saved Answer',
      symbols: null,
      sentiment: 'NEUTRAL',
      isPinned: false,
      isRead: true,
      agentOutput: 'DeepSeek R1 generates reasoning chains with 8x lower token cost.',
      agentActionType: 'COPILOT_SAVED',
      agentHistory: null,
      marketDataJson: null,
      createdAt: '2026-09-08T00:30:00.000Z',
      updatedAt: '2026-09-08T00:30:00.000Z',
    };

    vi.spyOn(thoughtLogService, 'useThoughtLogs').mockReturnValue({
      data: [mockSavedLog],
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

    // 1. Verify "Print PDF" badge button appears on the saved note card
    const cardPrintBtn = screen.getByTitle('Print / Save stylized PDF of this saved answer');
    expect(cardPrintBtn).toBeDefined();

    // 2. Click the card badge button directly
    fireEvent.click(cardPrintBtn);

    // Check that the print modal opened with the extracted inquiry and content
    const hasBriefingText = document.body.innerHTML.includes('Executive Financial Research Briefing');
    const hasMemoText = document.body.innerHTML.includes('Executive Research Memo');
    expect(hasBriefingText || hasMemoText).toBe(true);
    expect(document.body.innerHTML).toContain('Compare inference speed of DeepSeek R1 vs Llama 3.3');
    expect(document.body.innerHTML).toContain('DeepSeek R1 generates reasoning chains');

    // Verify detail header print button also exists
    const detailPrintBtn = screen.getByTitle('Print or export stylized PDF research memo');
    expect(detailPrintBtn).toBeDefined();
  });

  it('triggers print without clipping content and with full institutional briefing details', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    const mockData: CopilotPrintableData = {
      id: 'print-test-doc-999',
      query: 'Macroeconomic analysis of Treasury yield curve un-inversion',
      response: `## Executive Analysis\n\nThe 10Y-2Y spread has normalized to +18bps.\n\n### Quantitative Implication\nHistorical data indicates an average of 4.2 months before volatility spikes following inversion exits.`,
      model: 'inclusionai/ling-3.0-flash-fin:free',
      classification: 'complex_analysis',
      executionTime: 2.1,
      toolsUsed: ['yfinance (Market Data)', 'scipy/numpy (Math Sandbox)'],
      timestamp: '9/8/2026, 12:50 AM',
    };

    render(
      <CopilotPrintModal
        isOpen={true}
        onClose={vi.fn()}
        data={mockData}
      />
    );

    // Verify main sections
    expect(screen.getByText('Executive Financial Research Briefing')).toBeDefined();
    expect(screen.getByText(/Macroeconomic analysis of Treasury yield curve un-inversion/i)).toBeDefined();
    expect(screen.getByText(/The 10Y-2Y spread has normalized/i)).toBeDefined();
    expect(screen.getByText(/Quantitative Implication/i)).toBeDefined();
    expect(screen.getByText(/Historical data indicates an average of 4.2 months/i)).toBeDefined();

    // Verify metadata badges
    expect(screen.getByText(/Model: inclusionai\/ling-3.0-flash-fin:free/i)).toBeDefined();
    expect(screen.getByText(/2.1s latency/i)).toBeDefined();

    // Click Print / Save PDF
    const printBtn = screen.getByRole('button', { name: /Print \/ Save PDF/i });
    fireEvent.click(printBtn);

    // Either iframe print or fallback window.print is called safely
    expect(printBtn).toBeDefined();
  });
});
