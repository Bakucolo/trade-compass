import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectIBKRHoldings() {
  const holdings = await prisma.holding.findMany({
    where: { broker: { name: 'Interactive Brokers' } },
    include: { broker: true }
  });

  console.log(`Found ${holdings.length} IBKR holdings:`);
  for (const h of holdings) {
    console.log(`- ${h.symbol} (${h.assetType}) | SpecificId: ${h.brokerSpecificId} | Qty: ${h.quantity} | AvgCost: ${h.averageCost} | MVal: ${h.marketValue} | Curr: ${h.currency}`);
  }

  await prisma.$disconnect();
}

inspectIBKRHoldings();
