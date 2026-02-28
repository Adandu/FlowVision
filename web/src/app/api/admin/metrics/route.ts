import { NextResponse } from 'next/server';
import os from 'os';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // OS Memory
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // OS Load Avg (1, 5, 15 min CPU load)
        const loadAvg = os.loadavg();
        const cpus = os.cpus().length;

        // ClickHouse Database Size
        const chSizeQuery = `
            SELECT 
                database, 
                table, 
                sum(bytes) AS size_bytes,
                sum(rows) AS total_rows
            FROM system.parts 
            WHERE active 
            GROUP BY database, table
            ORDER BY size_bytes DESC
        `;

        const chRes = await clickhouse.query({ query: chSizeQuery, format: 'JSONEachRow' });
        const tables = await chRes.json();

        let totalDbBytes = 0;
        let totalDbRows = 0;
        tables.forEach((t: any) => {
            if (t.database === 'default') {
                totalDbBytes += Number(t.size_bytes);
                totalDbRows += Number(t.total_rows);
            }
        });

        // ClickHouse uptime/version
        const buildInfoRes = await clickhouse.query({ query: "SELECT version(), uptime()", format: 'JSONEachRow' });
        const buildInfo = await buildInfoRes.json() as any[];

        return NextResponse.json({
            success: true,
            data: {
                system: {
                    platform: os.platform(),
                    release: os.release(),
                    uptime: os.uptime(),
                    cpuCount: cpus,
                    loadAvg,
                    memory: {
                        total: totalMem,
                        free: freeMem,
                        used: usedMem,
                        percentUsed: (usedMem / totalMem) * 100
                    }
                },
                database: {
                    version: buildInfo[0]['version()'],
                    uptime: buildInfo[0]['uptime()'],
                    totalBytes: totalDbBytes,
                    totalRows: totalDbRows,
                    tables: tables.filter((t: any) => t.database === 'default').map((t: any) => ({
                        name: t.table,
                        bytes: Number(t.size_bytes),
                        rows: Number(t.total_rows)
                    }))
                }
            }
        });
    } catch (error) {
        console.error('Metrics API failed:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 });
    }
}
