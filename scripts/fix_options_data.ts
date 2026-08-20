
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing options data...');
    const options = await prisma.holding.findMany({
        where: {
            // Fetch all holdings to be safe, or filter by symbol length?
            // Let's fetch all where symbol length is 21 (OCC standard)
            // Prisma doesn't support length filtering directly easily in all versions.
            // So just fetch all.
        }
    });

    console.log(`Scanning ${options.length} holdings...`);
    let updatedCount = 0;

    for (const opt of options) {
        const symbol = opt.brokerSpecificId;
        // Check if it looks like an OCC symbol
        if (!symbol || symbol.length !== 21) continue;

        // Verify it has digits in date part and strike part to be sure
        // Simple check: 
        // 6 chars (Root) 6 digits (Date) 1 char (C/P) 8 digits (Strike)
        // Regex: /^.{6}\d{6}[CP]\d{8}$/
        if (!/^[A-Za-z ]{6}\d{6}[CP]\d{8}$/.test(symbol)) continue;

        let optionType = opt.optionType;
        let strikePrice = Number(opt.strikePrice);

        // Parse Type
        const typeChar = symbol[12];
        let newOptionType = null;
        if (typeChar === 'C') newOptionType = 'Call';
        else if (typeChar === 'P') newOptionType = 'Put';

        // Parse Strike
        let newStrikePrice = strikePrice;
        const strikePart = symbol.substring(13);
        const strikeVal = parseInt(strikePart, 10);
        if (!isNaN(strikeVal)) {
            newStrikePrice = strikeVal / 1000;
        }

        if (newOptionType && (optionType !== newOptionType || Math.abs(strikePrice - newStrikePrice) > 0.001)) {
            console.log(`Updating ${symbol}: Type=${newOptionType}, Strike=${newStrikePrice}`);
            await prisma.holding.update({
                where: { id: opt.id },
                data: {
                    optionType: newOptionType,
                    strikePrice: newStrikePrice,
                    assetType: 'OPTION'
                }
            });
            updatedCount++;
        }
    }
    console.log(`Done. Updated ${updatedCount} records.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
