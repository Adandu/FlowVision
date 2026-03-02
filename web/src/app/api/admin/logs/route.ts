import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(req: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const service = url.searchParams.get('service');
    const lines = parseInt(url.searchParams.get('lines') || '500', 10);

    const allowedServices = ['clickhouse', 'telegraf', 'nextjs'];
    if (!service || !allowedServices.includes(service)) {
        return NextResponse.json({ success: false, error: 'Invalid service' }, { status: 400 });
    }

    try {
        // Read the supervisord logs for the requested service
        // Since we are running inside docker managed by supervisord, we can use supervisorctl
        const { stdout, stderr } = await execAsync(`supervisorctl tail -${lines} ${service} stderr`);
        let logs = stderr || stdout;

        if (!logs) {
            logs = "No recent logs found or service is not emitting logs.";
        }

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        console.error('Failed to fetch logs:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to execute supervisorctl command' }, { status: 500 });
    }
}
