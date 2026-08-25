import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dedupHoldings() {
  const broker = await prisma.broker.findUnique({ where: { name: 'Interactive Brokers' } });
  if (!broker) return;

  const holdings = await prisma.holding.findMany({
    where: { brokerId: broker.id }
  });

  const prefixedIds = new Set(
    holdings
      .filter(h => h.brokerSpecificId.startsWith('U14522424_') || h.brokerSpecificId.startsWith('U15491236_'))
      .map(h => h.brokerSpecificId.replace(/^(U\d+_)/, ''))
  );

  let deleted = 0;
  for (const h of holdings) {
    if (!h.brokerSpecificId.startsWith('U14522424_') && !h.brokerSpecificId.startsWith('U15491236_')) {
      if (prefixedIds.has(h.brokerSpecificId)) {
        await prisma.holding.delete({ where: { id: h.id } });
        deleted++;
      } else {
        const isOption = h.assetType === 'OPTION' || h.quantity < 0;
        const targetAccount = isOption ? 'U15491236' : 'U14522424';
        try {
          await prisma.holding.update({
            where: { id: h.id },
            data: { brokerSpecificId: `${targetAccount}_${h.brokerSpecificId}` }
          });
        } catch (e) {}
      }
    }
  }

  console.log(`Cleaned up ${deleted} redundant unprefixed legacy records.`);
  await prisma.$disconnect();
}

dedupHoldings();
