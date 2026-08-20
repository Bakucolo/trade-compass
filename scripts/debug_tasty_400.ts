// scripts/debug_tasty_400.ts
import TastytradeClient from '@tastytrade/api';

// ⚠️ REPLACE THESE WITH YOUR REAL CREDENTIALS
const USERNAME = 'colohorizontal@gmail.com';
const PASSWORD = '32jJK5KqYLCv4AlXSnNB';
const IS_SANDBOX = false; // Set to true if using a Sandbox account

async function debugLogin() {
    const baseUrl = IS_SANDBOX
        ? 'https://api.cert.tastyworks.com'
        : 'https://api.tastyworks.com';

    console.log(`\n🔍 Attempting connection to: ${baseUrl}`);

    try {
        // FIX 1: The constructor often expects an object configuration
        const client = new TastytradeClient({ baseUrl });

        // FIX 2: Use 'sessionService.login' instead of 'session.create'
        const response = await client.sessionService.login(USERNAME, PASSWORD);

        // The SDK returns a response object where the session is inside 'data' or the object itself
        // We print the keys to be sure what we got back
        console.log('✅ Login Successful!');
        console.log('Session Token:', response.sessionToken || response['session-token']);
        console.log('User Email:', response.user.email);

    } catch (error: any) {
        console.error('\n❌ LOGIN FAILED');

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Message:', error.response.data?.error?.message || error.message);
        } else {
            console.error('Error:', error.message);
        }
    }
}

debugLogin();