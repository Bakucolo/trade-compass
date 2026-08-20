const API_KEY = 'da1aue9r01qo0t0lops0da1aue9r01qo0t0lopsg';

async function getQuote(symbol) {
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`);
  return await res.json();
}

async function main() {
  console.log("ONDS:", await getQuote('ONDS'));
  console.log("KVYO:", await getQuote('KVYO'));
  console.log("Z:", await getQuote('Z'));
  console.log("SATL:", await getQuote('SATL'));
}
main();
