import { runPortfolioValuationAgent } from '../server/services/portfolioValuationService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runEdgeCaseTests() {
  console.log('--- TEST 1: Empty Positions ---');
  try {
    const res1 = await runPortfolioValuationAgent([], undefined, console.log);
    console.log('Test 1 Passed: Title:', res1.title, 'Holdings count:', res1.holdings.length, 'Score:', res1.portfolioScore);
  } catch (e: any) {
    console.error('Test 1 Failed:', e.message);
  }

  console.log('\n--- TEST 2: Currency & Invalid Tickers ---');
  try {
    const positions2 = [
      { symbol: 'USD', quantity: 1000, marketValue: 1000, assetType: 'Stock', source: 'IBKR' },
      { symbol: 'GBP', quantity: 500, marketValue: 650, assetType: 'Stock', source: 'IBKR' },
      { symbol: 'FAKE_SYM_9999_XXX', quantity: 10, currentPrice: 50, marketValue: 500, assetType: 'Stock', source: 'Tastytrade' },
      { symbol: 'AAPL', quantity: 10, currentPrice: 225, marketValue: 2250, assetType: 'Stock', source: 'IBKR' }
    ];
    const res2 = await runPortfolioValuationAgent(positions2, undefined, console.log);
    console.log('Test 2 Passed: Title:', res2.title, 'Holdings count:', res2.holdings.length, 'Score:', res2.portfolioScore);
  } catch (e: any) {
    console.error('Test 2 Failed:', e.message);
  }

  await prisma.$disconnect();
}

runEdgeCaseTests();
