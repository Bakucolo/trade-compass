const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function restore() {
  try {
    let text = fs.readFileSync('portfolio_dump.json', 'utf16le');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    
    // Fallback block if utf16 is not the core encoding
    if (!text.startsWith('[')) {
        text = fs.readFileSync('portfolio_dump.json', 'utf8');
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    }

    const data = JSON.parse(text);
    for (const item of data) {
        delete item.updatedAt;
        const oldId = item.id;
        delete item.id;
        if (!item.broker) continue;
        const broker = await prisma.broker.upsert({
            where: { name: item.broker.name },
            update: { status: 'connected', lastSyncTime: new Date() },
            create: { name: item.broker.name, status: 'connected', lastSyncTime: new Date() }
        });
        delete item.broker;
        item.brokerId = broker.id;
        await prisma.holding.upsert({
            where: {
                brokerId_brokerSpecificId: { brokerId: item.brokerId, brokerSpecificId: item.brokerSpecificId }
            },
            update: item,
            create: item
        });
    }
    console.log("DB Restored Successfully");
  } catch (error) {
    console.error("Restore failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}
restore();
