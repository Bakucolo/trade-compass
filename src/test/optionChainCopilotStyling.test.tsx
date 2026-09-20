// src/test/optionChainCopilotStyling.test.tsx
// Comprehensive tests for Option Chain Copilot Normalization, UI Matrix, and <br> Tag Resolution

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptionChainCard } from '../components/OptionChainCard';
import { FormattedOptionChain } from '../services/tastytrade';
import { normalizeTastyOptionChain, executeReadOnlyTool } from '../../server/services/tastytradeToolService';
import * as tastyService from '../../server/services/tastytradeService';

describe('Option Chain Copilot Styling & Matrix', () => {
  const mockOptionChainData: FormattedOptionChain = {
    symbol: 'KVYO',
    underlyingPrice: 28.50,
    expirations: [
      {
        expirationDate: '2026-10-16',
        dte: 28,
        strikes: [
          {
            strike: 25.0,
            formattedStrike: '$25.00',
            callSymbol: 'KVYO261016C00025000',
            callName: '$25.00 Call',
            putSymbol: 'KVYO261016P00025000',
            putName: '$25.00 Put',
            isAtm: false
          },
          {
            strike: 28.0,
            formattedStrike: '$28.00',
            callSymbol: 'KVYO261016C00028000',
            callName: '$28.00 Call',
            putSymbol: 'KVYO261016P00028000',
            putName: '$28.00 Put',
            isAtm: true
          },
          {
            strike: 30.0,
            formattedStrike: '$30.00',
            callSymbol: 'KVYO261016C00030000',
            callName: '$30.00 Call',
            putSymbol: 'KVYO261016P00030000',
            putName: '$30.00 Put',
            isAtm: false
          }
        ]
      },
      {
        expirationDate: '2026-11-20',
        dte: 63,
        strikes: [
          {
            strike: 30.0,
            formattedStrike: '$30.00',
            callSymbol: 'KVYO261120C00030000',
            callName: '$30.00 Call',
            putSymbol: 'KVYO261120P00030000',
            putName: '$30.00 Put',
            isAtm: true
          }
        ]
      }
    ]
  };

  describe('1. normalizeTastyOptionChain Helper', () => {
    it('normalizes nested Tastytrade option chain without raw OCC symbol dumps', () => {
      const rawTastyNested = [
        {
          'underlying-symbol': 'KVYO',
          expirations: [
            {
              'expiration-date': '2026-10-16',
              'days-to-expiration': 28,
              strikes: [
                { 'strike-price': '5.0', call: 'KVYO240416C00005000', put: 'KVYO240416P00005000' },
                { 'strike-price': '6.0', call: 'KVYO240416C00006000', put: 'KVYO240416P00006000' },
                { 'strike-price': '7.0', call: 'KVYO240416C00007000', put: 'KVYO240416P00007000' }
              ]
            }
          ]
        }
      ];

      const normalized = normalizeTastyOptionChain('KVYO', rawTastyNested, 6.2);

      expect(normalized.symbol).toBe('KVYO');
      expect(normalized.underlyingPrice).toBe(6.2);
      expect(normalized.expirations.length).toBe(1);

      const exp = normalized.expirations[0];
      expect(exp.expirationDate).toBe('2026-10-16');
      expect(exp.dte).toBe(28);
      expect(exp.strikes.length).toBe(3);

      expect(exp.strikes[0].formattedStrike).toBe('$5.00');
      expect(exp.strikes[0].callName).toBe('$5.00 Call');
      expect(exp.strikes[0].putName).toBe('$5.00 Put');

      // Strike $6.00 is closest to spot 6.2 -> ATM flagged
      expect(exp.strikes[1].isAtm).toBe(true);
    });

    it('creates sensible fallback strikes if Tastytrade returns empty chain in sandbox', () => {
      const normalized = normalizeTastyOptionChain('AAPL', null, 220);
      expect(normalized.symbol).toBe('AAPL');
      expect(normalized.expirations.length).toBeGreaterThan(0);
      expect(normalized.expirations[0].strikes.some(s => s.isAtm)).toBe(true);
    });
  });

  describe('2. OptionChainCard Component UI & Interactions', () => {
    it('renders clean underlier, spot price, and expiration date tabs', () => {
      render(<OptionChainCard initialChain={mockOptionChainData} />);

      expect(screen.getByText(/KVYO Options Chain/i)).toBeInTheDocument();
      expect(screen.getByText(/\$28.50/i)).toBeInTheDocument();
      expect(screen.getByText('2026-10-16')).toBeInTheDocument();
      expect(screen.getByText('2026-11-20')).toBeInTheDocument();
    });

    it('displays the 3-column strike matrix with Calls on left, Strike in center, and Puts on right', () => {
      render(<OptionChainCard initialChain={mockOptionChainData} />);

      // Columns
      expect(screen.getByText(/Calls \(Bullish\)/i)).toBeInTheDocument();
      expect(screen.getByText(/^Strike$/i)).toBeInTheDocument();
      expect(screen.getByText(/Puts \(Bearish\)/i)).toBeInTheDocument();

      // Strikes and names
      expect(screen.getByText('$25.00 Call')).toBeInTheDocument();
      expect(screen.getByText('$25.00 Put')).toBeInTheDocument();
      expect(screen.getByText('$28.00')).toBeInTheDocument();
      expect(screen.getByText(/★ ATM/i)).toBeInTheDocument();
    });

    it('switches expiration dates when clicking tabs', () => {
      render(<OptionChainCard initialChain={mockOptionChainData} />);

      // Switch to Nov 20 expiration
      const novTab = screen.getByText('2026-11-20');
      fireEvent.click(novTab);

      // Now Nov 20 strikes should be visible
      expect(screen.getByText('$30.00 Call')).toBeInTheDocument();
      expect(screen.getByText('$30.00 Put')).toBeInTheDocument();
    });

    it('triggers onSelectContract when clicking Draft on a Call or Put contract', () => {
      const onSelect = vi.fn();
      render(<OptionChainCard initialChain={mockOptionChainData} onSelectContract={onSelect} />);

      // Click on Call button for $28.00
      const callButton = screen.getByTitle(/Click to draft Buy Order for KVYO \$28.00 Call/i);
      fireEvent.click(callButton);

      expect(onSelect).toHaveBeenCalledWith(
        'BUY',
        'CALL',
        28.0,
        '2026-10-16',
        'KVYO261016C00028000'
      );
    });

    it('automatically captures and displays contract price when clicking Draft on strike with callPrice/putPrice', () => {
      const onSelect = vi.fn();
      const chainWithPrices: FormattedOptionChain = {
        symbol: 'KVYO',
        underlyingPrice: 28.50,
        expirations: [
          {
            expirationDate: '2026-10-16',
            dte: 28,
            strikes: [
              {
                strike: 15.0,
                formattedStrike: '$15.00',
                callSymbol: 'KVYO261016C00015000',
                callName: '$15.00 Call',
                putSymbol: 'KVYO261016P00015000',
                putName: '$15.00 Put',
                callPrice: 13.80,
                putPrice: 0.65,
                isAtm: false
              }
            ]
          }
        ]
      };

      render(<OptionChainCard initialChain={chainWithPrices} onSelectContract={onSelect} />);

      // Verify contract prices are displayed on the draft buttons
      expect(screen.getByText('Draft $13.80')).toBeInTheDocument();
      expect(screen.getByText('Draft $0.65')).toBeInTheDocument();

      // Click on Put Draft button for $15.00 Put
      const putBtn = screen.getByTitle(/Click to draft Buy Order for KVYO \$15.00 Put at \$0.65/i);
      fireEvent.click(putBtn);

      expect(onSelect).toHaveBeenCalledWith(
        'BUY',
        'PUT',
        15.0,
        '2026-10-16',
        'KVYO261016P00015000',
        0.65
      );
    });

    it('triggers onSelectContract with action "SELL" when clicking dedicated Short button on a Call or Put row', () => {
      const onSelect = vi.fn();
      render(<OptionChainCard initialChain={mockOptionChainData} onSelectContract={onSelect} />);

      // Find the Short button for $28.00 Call
      const shortCallBtn = screen.getByTitle(/Click to draft Short \(Sell to Open\) Order for KVYO \$28.00 Call/i);
      expect(shortCallBtn).toBeInTheDocument();
      fireEvent.click(shortCallBtn);

      expect(onSelect).toHaveBeenCalledWith(
        'SELL',
        'CALL',
        28.0,
        '2026-10-16',
        'KVYO261016C00028000'
      );

      // Find the Short button for $28.00 Put
      const shortPutBtn = screen.getByTitle(/Click to draft Short \(Sell to Open\) Order for KVYO \$28.00 Put/i);
      expect(shortPutBtn).toBeInTheDocument();
      fireEvent.click(shortPutBtn);

      expect(onSelect).toHaveBeenCalledWith(
        'SELL',
        'PUT',
        28.0,
        '2026-10-16',
        'KVYO261016P00028000'
      );
    });

    it('switches between Buy and Sell modes via header toggle and updates primary buttons', () => {
      const onSelect = vi.fn();
      render(<OptionChainCard initialChain={mockOptionChainData} onSelectContract={onSelect} />);

      // Initially in Buy mode
      const sellToggle = screen.getByTitle(/Set default action to Sell \(Short \/ STO\)/i);
      fireEvent.click(sellToggle);

      // Now Short mode is active; header should have Short badges
      expect(screen.getAllByText(/Short \(STO\)/i).length).toBeGreaterThanOrEqual(1);

      // In Short mode, the primary button drafts Short orders
      const primaryShortCallBtn = screen.getByTitle(/Click to draft Short Order for KVYO \$28.00 Call/i);
      expect(primaryShortCallBtn).toBeInTheDocument();
      fireEvent.click(primaryShortCallBtn);

      expect(onSelect).toHaveBeenCalledWith(
        'SELL',
        'CALL',
        28.0,
        '2026-10-16',
        'KVYO261016C00028000'
      );

      // Quick Buy button should be present in Short mode
      const quickBuyBtn = screen.getByTitle(/Click to draft Buy Order for KVYO \$28.00 Call/i);
      expect(quickBuyBtn).toBeInTheDocument();
      fireEvent.click(quickBuyBtn);

      expect(onSelect).toHaveBeenCalledWith(
        'BUY',
        'CALL',
        28.0,
        '2026-10-16',
        'KVYO261016C00028000'
      );
    });

    it('honors defaultAction="SELL" and passes action parameter to onSelectStrike', () => {
      const onSelectStrike = vi.fn();
      render(
        <OptionChainCard
          initialChain={mockOptionChainData}
          defaultAction="SELL"
          onSelectStrike={onSelectStrike}
        />
      );

      // Verify initialized in Short mode
      expect(screen.getAllByText(/Short \(STO\)/i).length).toBeGreaterThanOrEqual(1);

      // Click primary short call button
      const shortCallBtn = screen.getByTitle(/Click to draft Short Order for KVYO \$28.00 Call/i);
      fireEvent.click(shortCallBtn);

      expect(onSelectStrike).toHaveBeenCalledWith(
        28.0,
        'Call',
        'KVYO',
        '2026-10-16',
        undefined,
        'SELL'
      );
    });
  });
});
