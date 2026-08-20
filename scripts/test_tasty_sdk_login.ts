
// Usage: npx tsx scripts/test_tasty_sdk_login.ts <username> <password> [sandbox: true/false]

import TastytradeClient from '@tastytrade/api';

async function testSdkLogin(username, password, isSandbox = false) {
    console.log(`Testing login for user: ${username} (Sandbox: ${isSandbox})`);

    try {
        const config = isSandbox ? TastytradeClient.SandboxConfig : TastytradeClient.ProdConfig;
        const client = new TastytradeClient(config);

        console.log('Initiating login via SDK...');
        const session = await client.sessionService.login(username, password);

        console.log('Login successful!');
        console.log('Session Token:', session['session-token']);
        console.log('User:', JSON.stringify(session.user, null, 2));

    } catch (e: any) {
        console.error('SDK Login Failed:', e.message);
        if (e.response) {
            console.error('Response Status:', e.response.status);
            console.error('Response Data:', JSON.stringify(e.response.data, null, 2));
        }
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Please provide username and password.');
    console.log('Usage: npx tsx scripts/test_tasty_sdk_login.ts <username> <password> [sandbox]');
    process.exit(1);
}

const user = args[0];
const pass = args[1];
const sandbox = args[2] === 'true';

testSdkLogin(user, pass, sandbox);
