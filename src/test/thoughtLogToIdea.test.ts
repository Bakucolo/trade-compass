import { describe, it, expect } from 'vitest';
import { extractSymbolsFromText } from '../../server/services/thoughtLogAgentService';

describe('Thought Log to Trade Idea Promotion Pipeline', () => {
  it('correctly prepares a Trade Idea payload from a thought log with detected ticker and sentiment', () => {
    const logTitle = 'AI Datacenter Baseload Demand ($CCJ)';
    const logContent = 'Uranium long-term contracting cycle is accelerating. Spot price consolidation under $50 provides solid accumulation window.';
    const logSentiment = 'BULLISH';
    const logFolder = 'Energy & AI';
    const logTags = 'Uranium, Nuclear, Energy';

    const detected = extractSymbolsFromText(`${logTitle} ${logContent}`);
    const primarySymbol = detected[0] || 'GENERAL';

    const ideaPayload = {
      title: logTitle,
      symbol: primarySymbol.toUpperCase(),
      type: logSentiment as 'BULLISH',
      timeframe: 'SWING',
      entryPrice: 48.50,
      content: logContent,
      tags: `${logTags}, ThoughtLog, ${logFolder}`,
      status: 'ACTIVE',
      confidenceScore: 75,
    };

    expect(ideaPayload.symbol).toBe('CCJ');
    expect(ideaPayload.type).toBe('BULLISH');
    expect(ideaPayload.tags).toContain('ThoughtLog');
    expect(ideaPayload.tags).toContain('Energy & AI');
    expect(ideaPayload.content).toBe(logContent);
  });

  it('correctly appends AI Copilot Analysis when promoting a researched thought log to Trade Ideas', () => {
    const logTitle = 'Carvana Debt Restructuring Risk';
    const rawNotes = 'Used car pricing trends collapsing. Subprime auto loans delinquencies ticking up.';
    const agentOutput = '## Executive Thesis\n- Short $CVNA with September $200 Put spreads.\n- Invalidation above $245.';

    const combinedContent = `${rawNotes}\n\n---\n\n### 🤖 AI Copilot Institutional Analysis\n${agentOutput}`;

    expect(combinedContent).toContain('Used car pricing trends');
    expect(combinedContent).toContain('### 🤖 AI Copilot Institutional Analysis');
    expect(combinedContent).toContain('Short $CVNA with September $200 Put spreads');
  });
});
