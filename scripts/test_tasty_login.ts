
// Usage: npx tsx scripts/test_tasty_login.ts <username> <password> [sandbox: true/false]
// Example: npx tsx scripts/test_tasty_login.ts myuser mypass false

const TASTY_LIVE_URL = 'https://api.tastyworks.com';
const TASTY_SANDBOX_URL = 'https://api.cert.tastyworks.com';

async function testLogin(username, password, isSandbox = false) {
    const baseUrl = isSandbox ? TASTY_SANDBOX_URL : TASTY_LIVE_URL;
    console.log(`Testing login to ${baseUrl} for user: ${username}`);

    try {
        const response = await fetch(`${baseUrl}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TradeCompass/1.0'
            },
            body: JSON.stringify({
                login: username,
                password: password,
                "remember-me": true
            })
        });

        console.log(`Status: ${response.status} ${response.statusText}`);

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            console.log('Response Body:', JSON.stringify(data, null, 2));

            if (data.data && data.data['session-token']) {
                console.log('SUCCESS: Session token received.');
            } else {
                console.log('FAILURE: No session token in response.');
            }
        } else {
            const text = await response.text();
            console.log('Non-JSON Response:', text);
        }

    } catch (e) {
        console.error('Network/Request Error:', e);
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Please provide username and password.');
    console.log('Usage: npx tsx scripts/test_tasty_login.ts <username> <password> [sandbox]');
    process.exit(1);
}

const user = args[0];
const pass = args[1];
const sandbox = args[2] === 'true';

testLogin(user, pass, sandbox);
