import { config } from 'dotenv';
config({ path: '.env.local' });
// polyfill import.meta.env
(global as any).import = { meta: { env: process.env } };

import { marketDataService } from '../src/services/marketData';

async function main() {
    try {
        console.log("Fetching quote for AAPL...");
        const quote = await marketDataService.getQuote('AAPL');
        console.log("AAPL Quote:", quote);

        console.log("Fetching quote for ONDS...");
        const quote2 = await marketDataService.getQuote('ONDS');
        console.log("ONDS Quote:", quote2);
    } catch (e) {
        console.error("Error:", e);
    }
}
main();
