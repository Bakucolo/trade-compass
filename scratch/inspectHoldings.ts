import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectHoldings() {
  const holdings = await prisma.holding.findMany({
    include: { broker: true }
  });

  console.log(`Found ${holdings.length} total holdings in DB:`);
  for (const h of holdings) {
    console.log(`- [${h.broker?.name || 'Unknown'}] ${h.symbol} | SpecificId: ${h.brokerSpecificId} | Qty: ${h.quantity} | MVal: ${h.marketValue} | Curr: ${h.currency}`);
  }

  await prisma.$disconnect();
}

inspectHoldings();
