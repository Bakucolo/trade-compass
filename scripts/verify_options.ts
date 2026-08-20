
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    try {
        const options = await prisma.holding.findMany({
            where: {
                assetType: 'OPTION'
            },
            take: 20
        });

        console.log(`Found ${options.length} options.`);

        if (options.length === 0) {
            console.log("No options found. Ensure you have synced data.");
            return;
        }

        console.log('Verifying Options Data:');
        options.forEach(opt => {
            console.log(`Symbol: ${String(opt.brokerSpecificId).padEnd(25)} | Type: ${String(opt.optionType).padEnd(5)} | Strike: ${String(opt.strikePrice).padEnd(8)} | Avg: ${opt.averageCost} | Mkt: ${opt.currentPrice}`);
        });

    } catch (error) {
        console.error("Error querying database:", error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
