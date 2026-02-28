import { clickhouse } from './clickhouse';

export interface IPAlias {
    ip: string;
    alias: string;
}

const ALIAS_CACHE_TTL = 300 * 1000; // 5 minutes
let aliasCache: Record<string, string> = {};
let aliasCacheTimestamp = 0;

/**
 * Fetches the active table of IP aliases and updates the in-memory cache periodically.
 */
export async function getAliasesMap(): Promise<Record<string, string>> {
    try {
        if (Date.now() - aliasCacheTimestamp < ALIAS_CACHE_TTL) {
            return aliasCache;
        }

        const rows = await clickhouse.query({
            query: `SELECT ip, alias FROM ip_aliases FINAL WHERE alias != ''`,
            format: 'JSONEachRow'
        }).then(r => r.json<IPAlias>());

        const newMap: Record<string, string> = {};
        rows.forEach(r => newMap[r.ip] = r.alias);

        aliasCache = newMap;
        aliasCacheTimestamp = Date.now();
        return aliasCache;
    } catch (err) {
        console.error('Failed to fetch IP aliases:', err);
        return aliasCache; // fallback to stale cache
    }
}

/**
 * Convenience function that replaces string properties of data objects with their alias, if available.
 * It modifies the object keys: ['src_ip', 'dst_ip', 'peer', 'ip']
 */
export async function applyAliases(data: any[]) {
    if (!data || data.length === 0) return data;

    const aliases = await getAliasesMap();
    if (Object.keys(aliases).length === 0) return data;

    data.forEach(item => {
        if (item.src_ip && aliases[item.src_ip]) item.src_ip = aliases[item.src_ip];
        if (item.dst_ip && aliases[item.dst_ip]) item.dst_ip = aliases[item.dst_ip];
        if (item.peer && aliases[item.peer]) item.peer = aliases[item.peer];
        if (item.ip && aliases[item.ip]) item.ip = aliases[item.ip];
    });

    return data;
}

/** Force refresh cache immediately */
export function invalidateAliasCache() {
    aliasCacheTimestamp = 0;
}
