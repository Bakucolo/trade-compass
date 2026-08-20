// scripts/debug_manual.ts
// ---------------------------------------------------------
// ⚠️ REPLACE WITH YOUR REAL CREDENTIALS BEFORE RUNNING
// ---------------------------------------------------------
const CREDS = {
    login: 'colohorizontal@gmail.com',
    password: '32jJK5KqYLCv4AlXSnNB',
    'remember-me': true
};

// scripts/debug_manual.ts
// ... (keep your credentials object)

async function testManualLogin() {
    console.log('🚀 Testing Direct HTTP Login with Headers...');

    try {
        const response = await fetch('https://api.tastyworks.com/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // CRITICAL: This makes you look like a valid desktop app
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // OPTIONAL: Sometimes helps to declare the software version
                'X-Tastyworks-App-Version': 'v1.0.0'
            },
            body: JSON.stringify(CREDS)
        });

        // We get the text first to avoid crashing on HTML responses
        const rawText = await response.text();

        try {
            const data = JSON.parse(rawText);

            if (!response.ok) {
                console.error(`\n❌ API Error (${response.status}):`);
                console.error('Code:', data.error?.code);
                console.error('Message:', data.error?.message);
            } else {
                console.log('\n✅ SUCCESS! Session Created.');
                console.log('Session Token:', data.data['session-token']);
                console.log('User:', data.data.user.email);
            }
        } catch (e) {
            console.error('\n❌ NON-JSON RESPONSE RECEIVED (WAF Block?)');
            console.error('Status:', response.status);
            console.error('Body Preview:', rawText.substring(0, 200)); // Print first 200 chars of HTML
        }

    } catch (err) {
        console.error('Network Error:', err);
    }
}

testManualLogin();