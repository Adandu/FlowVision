export const PORT_TO_APP: Record<number, string> = {
    // Web
    80: 'HTTP',
    443: 'HTTPS',
    8080: 'HTTP Alt',
    8443: 'HTTPS Alt',

    // Infrastructure / Core
    53: 'DNS',
    853: 'DNS-over-TLS',
    123: 'NTP',
    67: 'DHCP',
    68: 'DHCP',

    // Remote Access
    22: 'SSH',
    23: 'Telnet',
    3389: 'RDP',
    5900: 'VNC',

    // File Transfer / DB
    20: 'FTP Data',
    21: 'FTP Control',
    445: 'SMB',
    137: 'NetBIOS',
    138: 'NetBIOS',
    139: 'NetBIOS',
    3306: 'MySQL',
    5432: 'PostgreSQL',
    6379: 'Redis',
    27017: 'MongoDB',

    // Mail
    25: 'SMTP',
    465: 'SMTPS',
    587: 'SMTP Submission',
    110: 'POP3',
    995: 'POP3S',
    143: 'IMAP',
    993: 'IMAPS',

    // Media / Games / P2P
    6881: 'BitTorrent',
    6882: 'BitTorrent',
    6889: 'BitTorrent',
    5004: 'RTP',
    5005: 'RTCP',
    1935: 'RTMP',

    // VPN
    1194: 'OpenVPN',
    500: 'IPsec/IKE',
    4500: 'IPsec/NAT-T',
    51820: 'WireGuard',
};

export function getAppName(port: number): string {
    return PORT_TO_APP[port] || `Port ${port}`;
}
