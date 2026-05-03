export function formatBytes(bytes: number, decimals = 2): string {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const idx = Math.min(i, sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

export function formatBits(bitsPerSecond: number, decimals = 2): string {
    if (!bitsPerSecond || bitsPerSecond <= 0) return '0 bps';
    const k = 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    const idx = Math.min(i, sizes.length - 1);
    return `${parseFloat((bitsPerSecond / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}
