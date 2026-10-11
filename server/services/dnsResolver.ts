// server/services/dnsResolver.ts
import dns from 'dns';

/**
 * Secure DNS Resolver utilizing DNS-over-HTTPS (DoH) via Cloudflare & Google
 * to prevent ISP DNS hijacking/poisoning (e.g. Kominfo / Indonesian ISP sinkholes)
 * for financial broker APIs (Tastytrade & Trading 212).
 */

const TARGET_HOSTS: Record<string, string[]> = {
  'api.tastytrade.com': ['23.53.15.139', '23.53.15.136'],
  'api.cert.tastyworks.com': ['23.53.15.139', '23.53.15.136'],
  'live.trading212.com': ['104.18.39.129', '172.64.148.127'],
  'demo.trading212.com': ['104.18.39.129', '172.64.148.127'],
  'api.telegram.org': ['149.154.167.220'],
};

const dohCache = new Map<string, { ips: string[]; expires: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function queryDoH(hostname: string): Promise<string[]> {
  const cached = dohCache.get(hostname);
  if (cached && Date.now() < cached.expires) {
    return cached.ips;
  }

  // 1. Try Cloudflare DoH (port 443 encrypted HTTPS)
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data: any = await res.json();
      const ips = (data.Answer || [])
        .filter((ans: any) => ans.type === 1) // Type 1 = A record
        .map((ans: any) => ans.data)
        .filter((ip: string) => !ip.startsWith('103.') && !ip.startsWith('182.23.') && !ip.startsWith('139.255.')); // Filter out ISP sinkholes

      if (ips.length > 0) {
        dohCache.set(hostname, { ips, expires: Date.now() + CACHE_TTL_MS });
        return ips;
      }
    }
  } catch {}

  // 2. Try Google DoH
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data: any = await res.json();
      const ips = (data.Answer || [])
        .filter((ans: any) => ans.type === 1)
        .map((ans: any) => ans.data)
        .filter((ip: string) => !ip.startsWith('103.') && !ip.startsWith('182.23.') && !ip.startsWith('139.255.'));

      if (ips.length > 0) {
        dohCache.set(hostname, { ips, expires: Date.now() + CACHE_TTL_MS });
        return ips;
      }
    }
  } catch {}

  // 3. Static fallback
  return TARGET_HOSTS[hostname] || [];
}

let isInitialized = false;

export function initDnsResolver() {
  if (isInitialized) return;
  isInitialized = true;

  const origLookup = dns.lookup;

  (dns as any).lookup = (hostname: string, options: any, callback: any) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (hostname && TARGET_HOSTS[hostname.toLowerCase()]) {
      const host = hostname.toLowerCase();
      queryDoH(host)
        .then((ips) => {
          const targetIp = ips.length > 0 ? ips[0] : TARGET_HOSTS[host][0];
          origLookup(targetIp, options, callback);
        })
        .catch(() => {
          origLookup(TARGET_HOSTS[host][0], options, callback);
        });
      return;
    }

    return origLookup(hostname, options, callback);
  };

  console.log('[DNS] Secure DoH Anti-Censorship DNS Resolver initialized for Tastytrade & Trading 212');
}
