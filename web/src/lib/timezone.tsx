'use client';
import { useState, useEffect, createContext, useContext, useMemo } from 'react';

// ─── Timezone offset helper ────────────────────────────────────────────────────
function getOffsetMinutes(ianaZone: string): number {
    try {
        const now = new Date();
        const dStr = now.toLocaleString('en-US', { timeZone: ianaZone, hour12: false });
        // parse the local string into a fake UTC date to get the exact ms diff
        const localTz = new Date(dStr + " UTC");
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false }) + " UTC");
        return Math.round((localTz.getTime() - utcDate.getTime()) / 60000);
    } catch { return 0; }
}

function offsetLabel(minutes: number): string {
    if (minutes === 0) return 'GMT+0';
    const sign = minutes > 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m === 0 ? `GMT${sign}${h}` : `GMT${sign}${h}:${String(m).padStart(2, '0')}`;
}

// ─── Raw timezone list (IANA names) ───────────────────────────────────────────
const RAW_ZONES = [
    'UTC',
    'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver',
    'America/Chicago', 'America/New_York', 'America/Sao_Paulo', 'America/Toronto',
    'America/Vancouver', 'America/Halifax', 'America/Argentina/Buenos_Aires',
    'Atlantic/Azores', 'Atlantic/Cape_Verde',
    'Europe/London', 'Europe/Lisbon', 'Africa/Casablanca',
    'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Madrid',
    'Europe/Rome', 'Europe/Warsaw', 'Africa/Lagos', 'Africa/Tunis',
    'Europe/Athens', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Bucharest',
    'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi',
    'Europe/Moscow', 'Asia/Dubai', 'Asia/Tehran',
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Yangon',
    'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Hong_Kong',
    'Asia/Tokyo', 'Asia/Seoul',
    'Australia/Perth', 'Australia/Adelaide', 'Australia/Sydney',
    'Pacific/Auckland', 'Pacific/Fiji',
];

export interface TZEntry {
    zone: string;          // IANA name
    offsetMin: number;     // e.g. 120
    label: string;         // e.g. "Europe/Bucharest (GMT+2)"
}

// Build + sort once on module load
export const TIMEZONE_LIST: TZEntry[] = RAW_ZONES
    .map(zone => {
        const offsetMin = getOffsetMinutes(zone);
        return { zone, offsetMin, label: `${zone} (${offsetLabel(offsetMin)})` };
    })
    .sort((a, b) => a.offsetMin - b.offsetMin || a.zone.localeCompare(b.zone));

export const DEFAULT_TIMEZONE = 'UTC';
const LS_KEY = 'flowvision_timezone';

// ─── Context ──────────────────────────────────────────────────────────────────
interface TZCtx { timezone: string; setTimezone: (tz: string) => void; }
export const TimezoneContext = createContext<TZCtx>({ timezone: DEFAULT_TIMEZONE, setTimezone: () => { } });
export function useTimezone() { return useContext(TimezoneContext); }

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
    const [timezone, setTimezoneState] = useState(DEFAULT_TIMEZONE);
    useEffect(() => {
        const stored = localStorage.getItem(LS_KEY);
        if (stored) setTimezoneState(stored);
    }, []);
    const setTimezone = (tz: string) => { setTimezoneState(tz); localStorage.setItem(LS_KEY, tz); };
    return <TimezoneContext.Provider value={{ timezone, setTimezone }}>{children}</TimezoneContext.Provider>;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export function formatTimestamp(value: string | Date | number, timezone: string): string {
    try {
        let dateVal = typeof value === 'string' && !value.endsWith('Z') && !value.includes('+') ? new Date(value + 'Z') : new Date(value);
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }).format(dateVal);
    } catch { return String(value); }
}

export function getTimezoneOffsetMinutes(timezone: string): number {
    return getOffsetMinutes(timezone);
}
