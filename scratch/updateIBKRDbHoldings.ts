import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateExistingHoldings() {
  const IBKR_ISA_ACCOUNT = 'U14522424';
  const IBKR_GIA_ACCOUNT = 'U15491236';

  const broker = await prisma.broker.findUnique({ where: { name: 'Interactive Brokers' } });
  if (!broker) {
    console.log('No Interactive Brokers entry found in DB.');
    return;
  }

  const holdings = await prisma.holding.findMany({
    where: { brokerId: broker.id }
  });

  console.log(`Found ${holdings.length} IBKR holdings to classify.`);

  let updatedCount = 0;
  for (const h of holdings) {
    const isOption = h.assetType === 'OPTION' || h.quantity < 0;
    const targetAccount = isOption ? IBKR_GIA_ACCOUNT : IBKR_ISA_ACCOUNT;
    
    // Check if brokerSpecificId already has the account prefix
    if (!h.brokerSpecificId.startsWith(targetAccount)) {
      const cleanConId = h.brokerSpecificId.replace(/^(U\d+_)/, '');
      const newSpecificId = `${targetAccount}_${cleanConId}`;
      
      try {
        await prisma.holding.update({
          where: { id: h.id },
          data: {
            brokerSpecificId: newSpecificId,
            description: h.description || `${h.symbol} (${targetAccount === IBKR_ISA_ACCOUNT ? 'ISA' : 'GIA'})`
          }
        });
        updatedCount++;
      } catch (err: any) {
        console.warn(`Could not update holding ${h.symbol}:`, err.message);
      }
    }
  }

  console.log(`Successfully classified and updated ${updatedCount} IBKR holdings.`);
  await prisma.$disconnect();
}

updateExistingHoldings();
