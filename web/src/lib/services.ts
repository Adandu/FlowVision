export const KNOWN_SERVICES: Record<string, { name: string; color: string }> = {
    // Cloud Providers
    'AS15169 GOOGLE': { name: 'Google Cloud / Services', color: '#4285F4' },
    'AS396982 GOOGLE-CLOUD-PLATFORM': { name: 'Google Cloud Platform', color: '#4285F4' },
    'AS16509 AMAZON-02': { name: 'Amazon Web Services', color: '#FF9900' },
    'AS14618 AMAZON-AES': { name: 'Amazon Web Services', color: '#FF9900' },
    'AS8075 MICROSOFT-CORP-MSN-AS-BLOCK': { name: 'Microsoft Azure', color: '#00A4EF' },
    'AS54113 FASTLY': { name: 'Fastly CDN', color: '#FF282D' },
    'AS13335 CLOUDFLARENET': { name: 'Cloudflare', color: '#F38020' },
    'AS20940 AKAMAI-ASN1': { name: 'Akamai CDN', color: '#0099CC' },
    'AS20473 AS-CHOOPA': { name: 'Vultr / Choopa', color: '#007BFC' },
    'AS14061 DIGITALOCEAN-ASN': { name: 'DigitalOcean', color: '#0080FF' },
    'AS31898 ORACLE-BMC-31898': { name: 'Oracle Cloud', color: '#C74634' },
    'AS63949 LINODE-AP Linode, LLC': { name: 'Linode', color: '#02B159' },

    // Social Media / Comms
    'AS32934 FACEBOOK': { name: 'Facebook / WhatsApp', color: '#1877F2' },
    'AS714 APPLE-ENGINEERING': { name: 'Apple Services', color: '#A2AAAD' },
    'AS13414 TWITTER': { name: 'X / Twitter', color: '#1DA1F2' },
    'AS394380 TIKTOK': { name: 'TikTok', color: '#FF0050' },
    'AS62041 TELEGRAM': { name: 'Telegram', color: '#2AABEE' },

    // Streaming & Gaming
    'AS2906 NETFLIX-ASN': { name: 'Netflix', color: '#E50914' },
    'AS40027 VALVE': { name: 'Steam / Valve', color: '#000000' },
    'AS23352 RIOT-GAMES': { name: 'Riot Games', color: '#D32936' },
    'AS54994 TWITCH': { name: 'Twitch', color: '#9146FF' },
    'AS55286 SPOTIFY': { name: 'Spotify', color: '#1ED760' },

    // ISP Defaults (Fallback names if AS name is somewhat obvious)
    'AS7922 COMCAST-7922': { name: 'Comcast / Xfinity', color: '#D9D9D9' },
    'AS7018 ATT-INTERNET4': { name: 'AT&T', color: '#0057B8' },
};

export function identifyService(asnString: string | undefined): { name: string; color: string } | null {
    if (!asnString) return null;

    // Direct Match
    if (KNOWN_SERVICES[asnString]) return KNOWN_SERVICES[asnString];

    // Fuzzier match based on keywords inside the ASN string
    const upper = asnString.toUpperCase();
    if (upper.includes('GOOGLE')) return { name: 'Google Services', color: '#4285F4' };
    if (upper.includes('AMAZON')) return { name: 'Amazon / AWS', color: '#FF9900' };
    if (upper.includes('MICROSOFT')) return { name: 'Microsoft', color: '#00A4EF' };
    if (upper.includes('CLOUDFLARE')) return { name: 'Cloudflare', color: '#F38020' };
    if (upper.includes('FACEBOOK') || upper.includes('META')) return { name: 'Meta / Facebook / WhatsApp', color: '#1877F2' };
    if (upper.includes('NETFLIX')) return { name: 'Netflix', color: '#E50914' };
    if (upper.includes('APPLE')) return { name: 'Apple Services', color: '#A2AAAD' };
    if (upper.includes('VALVE')) return { name: 'Steam Games', color: '#000000' };
    if (upper.includes('AKAMAI')) return { name: 'Akamai CDN', color: '#0099CC' };
    if (upper.includes('FASTLY')) return { name: 'Fastly CDN', color: '#FF282D' };

    return null; // Unknown Service
}
