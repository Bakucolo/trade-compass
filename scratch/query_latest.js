import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const latest = await prisma.thoughtLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  console.log('Latest 5 logs:');
  console.log(JSON.stringify(latest, null, 2));
}

main().finally(() => prisma.$disconnect());
