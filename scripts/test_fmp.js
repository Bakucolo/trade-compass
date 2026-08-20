const url = 'https://financialmodelingprep.com/stable/profile?symbol=ONDS&apikey=XEscJAVpadzgNNMNdAaj0pm6w7lY9qRW';
fetch(url).then(res => res.json()).then(console.log).catch(console.error);
