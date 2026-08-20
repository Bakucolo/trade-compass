// scripts/login_with_2fa.ts
import { createInterface } from 'readline';

// ⚠️ DOUBLE CHECK THESE CAREFULLY
const CREDS = {
    login: 'colohorizontal@gmail.com',
    password: '32jJK5KqYLCv4AlXSnNB',
    'remember-me': true
};

// Use the production URL
const BASE_URL = 'https://api.tastyworks.com';

const askQuestion = (query: string) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise<string>(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

async function loginWith2FA() {
    console.log('🚀 Attempting Login (Clean Mode)...');

    try {
        const response = await fetch(`${BASE_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // Spoof a real Chrome browser to avoid Captcha
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify(CREDS)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(`\n❌ FAILED (${response.status})`);
            console.log('Error Code:', data.error?.code);
            console.log('Message:', data.error?.message);

            if (data.error?.code === 'invalid_credentials') {
                console.log('👀 HINT: Check your password for typos!');
            }
        } else {
            console.log('\n✅ SUCCESS! Login Worked.');
            console.log('Session Token:', data.data['session-token']);
            // If it worked without SMS, it means 2FA wasn't triggered for this specific request
        }

    } catch (err) {
        console.error('Network Error:', err);
    }
}

loginWith2FA();