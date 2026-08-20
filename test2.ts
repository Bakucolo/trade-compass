import * as yfModule from 'yahoo-finance2';
console.log('Exports:', Object.keys(yfModule));
console.log('Default type:', typeof yfModule.default);
if (yfModule.default) {
    console.log('Default keys:', Object.keys(yfModule.default));
    console.log('Quote type:', typeof (yfModule.default as any).quote);
}
