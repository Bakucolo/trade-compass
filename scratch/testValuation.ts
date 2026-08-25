import { runPortfolioValuationAgent } from '../server/services/portfolioValuationService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  console.log('Testing runPortfolioValuationAgent...');
  const positions = [
    { symbol: 'NVDA', quantity: 10, currentPrice: 125, marketValue: 1250, assetType: 'Stock', source: 'IBKR' },
    { symbol: 'AAPL', quantity: 20, currentPrice: 220, marketValue: 4400, assetType: 'Stock', source: 'IBKR' },
    { symbol: 'TSLA', quantity: 5, currentPrice: 240, marketValue: 1200, assetType: 'Stock', source: 'Tastytrade' }
  ];

  try {
    const result = await runPortfolioValuationAgent(positions, undefined, console.log);
    console.log('SUCCESS! Result title:', result.title, 'Score:', result.portfolioScore, 'Holdings count:', result.holdings.length);
  } catch (err: any) {
    console.error('FAILED with error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
