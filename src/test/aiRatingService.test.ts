import { describe, it, expect } from 'vitest';
import { calculateConsensus, ModelRatingResult } from '../../server/services/aiRatingService';

describe('AI Rating Service Multi-LLM Consensus Engine', () => {
  const mockModelsBullish: ModelRatingResult[] = [
    {
      modelId: 'claude-3-5',
      modelName: 'Claude 3.5 Sonnet',
      provider: 'openrouter',
      rating: 'BUY',
      conviction: 9,
      targetPrice: 280,
      upsidePercent: 21.7,
      bullThesis: 'Robust hyperscaler cloud margins and enterprise AI backlog.',
      bearRisk: 'Geopolitical hardware tariff pressures.',
      summary: 'High conviction long on secular enterprise adoption.',
      latencyMs: 820,
      success: true,
    },
    {
      modelId: 'gpt-4o',
      modelName: 'OpenAI GPT-4o',
      provider: 'openrouter',
      rating: 'BUY',
      conviction: 8,
      targetPrice: 275,
      upsidePercent: 19.5,
      bullThesis: 'Accelerating software revenue and expanding operating leverage.',
      bearRisk: 'Short-term multiples decompression.',
      summary: 'Strong buy on cash flow durability.',
      latencyMs: 740,
      success: true,
    },
    {
      modelId: 'deepseek-r1',
      modelName: 'DeepSeek R1 / V3',
      provider: 'openrouter',
      rating: 'BUY',
      conviction: 8,
      targetPrice: 270,
      upsidePercent: 17.4,
      bullThesis: 'Deep competitive moat in data ecosystem.',
      bearRisk: 'Capex intensity acceleration.',
      summary: 'Solid risk-adjusted return profile over 12 months.',
      latencyMs: 1100,
      success: true,
    },
    {
      modelId: 'llama-3-3',
      modelName: 'Meta Llama 3.3 70B',
      provider: 'groq',
      rating: 'HOLD',
      conviction: 6,
      targetPrice: 240,
      upsidePercent: 4.3,
      bullThesis: 'Steady subscription recurring cash flow.',
      bearRisk: 'Valuation fully reflects growth runway.',
      summary: 'Hold for better pullbacks into support.',
      latencyMs: 450,
      success: true,
    },
    {
      modelId: 'gemini-2-flash',
      modelName: 'Google Gemini 2.0 Flash',
      provider: 'google-ai-studio',
      rating: 'BUY',
      conviction: 8,
      targetPrice: 265,
      upsidePercent: 15.2,
      bullThesis: 'Broad portfolio renewal strength.',
      bearRisk: 'Macro currency headwind.',
      summary: 'Positive stance on strong balance sheet.',
      latencyMs: 380,
      success: true,
    },
  ];

  it('should compute bullish consensus (BUY/STRONG_BUY) with high conviction for majority buy models', () => {
    const consensus = calculateConsensus(
      'MSFT',
      'Microsoft Corporation',
      230,
      'Technology',
      'Software—Infrastructure',
      mockModelsBullish
    );

    expect(consensus.symbol).toBe('MSFT');
    expect(consensus.companyName).toBe('Microsoft Corporation');
    expect(consensus.currentPrice).toBe(230);
    expect(['BUY', 'STRONG_BUY']).toContain(consensus.consensusRating);
    expect(consensus.ratingsCount.BUY).toBe(4);
    expect(consensus.ratingsCount.HOLD).toBe(1);
    expect(consensus.ratingsCount.SELL).toBe(0);
    expect(consensus.buyPercentage).toBe(80);
    expect(consensus.holdPercentage).toBe(20);
    expect(consensus.sellPercentage).toBe(0);

    // Blended conviction should be between 1 and 10, around ~7.8
    expect(consensus.blendedConviction).toBeGreaterThanOrEqual(7.0);
    expect(consensus.blendedConviction).toBeLessThanOrEqual(10.0);
    expect(['HIGH', 'VERY_HIGH']).toContain(consensus.convictionStrength);

    // Blended price target
    expect(consensus.blendedTargetPrice).toBeGreaterThan(250);
    expect(consensus.impliedUpsidePercent).toBeGreaterThan(10);

    // Executive summary and key drivers
    expect(consensus.consensusSummary).toContain('MSFT');
    expect(consensus.consensusSummary).toContain('buy');
    expect(consensus.topBullDriver.length).toBeGreaterThan(10);
    expect(consensus.topBearRisk.length).toBeGreaterThan(10);
  });

  it('should compute bearish consensus (SELL/STRONG_SELL) when models unanimously vote SELL', () => {
    const mockModelsBearish: ModelRatingResult[] = [
      {
        modelId: 'claude-3-5',
        modelName: 'Claude 3.5 Sonnet',
        provider: 'openrouter',
        rating: 'SELL',
        conviction: 9,
        targetPrice: 15,
        upsidePercent: -35.0,
        bullThesis: 'Brand heritage.',
        bearRisk: 'Severe cash burn and imminent dilution.',
        summary: 'Underperform rating.',
        latencyMs: 600,
        success: true,
      },
      {
        modelId: 'gpt-4o',
        modelName: 'OpenAI GPT-4o',
        provider: 'openrouter',
        rating: 'SELL',
        conviction: 8,
        targetPrice: 14,
        upsidePercent: -39.1,
        bullThesis: 'Restructuring plan optionality.',
        bearRisk: 'Structural debt overhang.',
        summary: 'Avoid capital impairment.',
        latencyMs: 550,
        success: true,
      },
    ];

    const consensus = calculateConsensus('ABC', 'ABC Distressed Corp', 23, 'Consumer', 'Retail', mockModelsBearish);

    expect(['SELL', 'STRONG_SELL']).toContain(consensus.consensusRating);
    expect(consensus.ratingsCount.SELL).toBe(2);
    expect(consensus.ratingsCount.BUY).toBe(0);
    expect(consensus.sellPercentage).toBe(100);
    expect(consensus.blendedConviction).toBeGreaterThanOrEqual(8.0);
    expect(consensus.blendedTargetPrice).toBe(14.5);
    expect(consensus.impliedUpsidePercent).toBeLessThan(0);
    expect(consensus.consensusSummary.toLowerCase()).toContain('bearish');
  });

  it('should compute HOLD consensus when models are split and conviction is moderate', () => {
    const mockModelsSplit: ModelRatingResult[] = [
      {
        modelId: 'claude-3-5',
        modelName: 'Claude 3.5',
        provider: 'openrouter',
        rating: 'BUY',
        conviction: 6,
        targetPrice: 105,
        summary: 'Modest upside.',
        bullThesis: 'Dividend yield.',
        bearRisk: 'Slow growth.',
        latencyMs: 500,
        success: true,
      },
      {
        modelId: 'gpt-4o',
        modelName: 'GPT-4o',
        provider: 'openrouter',
        rating: 'SELL',
        conviction: 6,
        targetPrice: 95,
        summary: 'Near peak multiples.',
        bullThesis: 'Market share.',
        bearRisk: 'Margin squeeze.',
        latencyMs: 480,
        success: true,
      },
      {
        modelId: 'gemini-2-flash',
        modelName: 'Gemini 2.0',
        provider: 'google-ai-studio',
        rating: 'HOLD',
        conviction: 5,
        targetPrice: 100,
        summary: 'Fairly valued.',
        bullThesis: 'Stable moat.',
        bearRisk: 'No clear catalysts.',
        latencyMs: 300,
        success: true,
      },
    ];

    const consensus = calculateConsensus('XYZ', 'XYZ Balanced Inc', 100, 'Industrials', 'Machinery', mockModelsSplit);

    expect(consensus.consensusRating).toBe('HOLD');
    expect(consensus.ratingsCount.BUY).toBe(1);
    expect(consensus.ratingsCount.SELL).toBe(1);
    expect(consensus.ratingsCount.HOLD).toBe(1);
    expect(consensus.blendedConviction).toBeCloseTo(5.7, 1);
    expect(consensus.blendedTargetPrice).toBe(100);
    expect(consensus.impliedUpsidePercent).toBe(0);
    expect(consensus.consensusSummary.toLowerCase()).toContain('hold');
  });

  it('should gracefully handle offline models and compute quorum from reporting models', () => {
    const mockWithFailure: ModelRatingResult[] = [
      {
        modelId: 'gpt-4o',
        modelName: 'OpenAI GPT-4o',
        provider: 'openrouter',
        rating: 'BUY',
        conviction: 8,
        targetPrice: 150,
        upsidePercent: 25,
        bullThesis: 'Cloud growth.',
        bearRisk: 'Valuation.',
        summary: 'Buy rating.',
        latencyMs: 500,
        success: true,
      },
      {
        modelId: 'claude-3-5',
        modelName: 'Claude 3.5',
        provider: 'openrouter',
        rating: 'HOLD',
        conviction: 5,
        bullThesis: 'Execution interrupted.',
        bearRisk: 'Model exception occurred.',
        summary: 'Failed to poll model: Request timeout',
        latencyMs: 0,
        success: false,
        error: 'Request timeout',
      },
    ];

    const consensus = calculateConsensus('TEST', 'Test Corp', 120, 'Tech', 'Software', mockWithFailure);

    expect(consensus.ratingsCount.BUY).toBe(1);
    expect(consensus.buyPercentage).toBe(100);
    expect(consensus.blendedConviction).toBe(8);
    expect(consensus.modelResults.length).toBe(2);
  });
});
