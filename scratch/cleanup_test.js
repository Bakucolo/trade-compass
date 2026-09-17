import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  await prisma.thoughtLog.deleteMany({
    where: { content: { contains: 'Test webhook connectivity' } },
  });
  console.log('Cleaned test entries.');
  await prisma.$disconnect();
}
run();
