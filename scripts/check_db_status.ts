
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking database connection...');
    try {
        // Try a simple query
        const brokerCount = await prisma.broker.count();
        console.log(`Successfully connected! Found ${brokerCount} brokers.`);

    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
