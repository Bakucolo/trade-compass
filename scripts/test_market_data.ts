import { marketDataService } from '../src/services/marketData';

async function main() {
    try {
        console.log("Fetching quote for ONDS...");
        const quote = await marketDataService.getQuote('ONDS');
        console.log("Quote:", quote);
    } catch (e) {
        console.error("Error:", e);
    }
}
main();
