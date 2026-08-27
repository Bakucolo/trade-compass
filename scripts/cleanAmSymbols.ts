import { PrismaClient } from '@prisma/client';
import { extractSymbolsFromText } from '../server/services/thoughtLogAgentService';

const prisma = new PrismaClient();

async function main() {
  const logs = await (prisma as any).thoughtLog.findMany();
  console.log(`Found ${logs.length} total ThoughtLog records.`);

  for (const log of logs) {
    const cleaned = extractSymbolsFromText(`${log.title} ${log.content}`);
    const newSymbols = cleaned.length > 0 ? cleaned.join(', ') : null;

    if (log.symbols !== newSymbols) {
      console.log(`Updating log "${log.title}":`);
      console.log(`  Old symbols: "${log.symbols}"`);
      console.log(`  New symbols: "${newSymbols}"`);
      await (prisma as any).thoughtLog.update({
        where: { id: log.id },
        data: { symbols: newSymbols }
      });
    }
  }
  console.log('Cleanup complete.');
  await prisma.$disconnect();
}

main().catch(console.error);
