'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLogsPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [service, setService] = useState('nextjs');
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [error, setError] = useState('');
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Verify admin access
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(j => {
                if (!j.success || j.user?.role !== 'admin') {
                    router.replace('/');
                    return;
                }
                setUser(j.user);
            });
    }, [router]);

    const fetchLogs = async (silent = false) => {
        if (!silent) setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/admin/logs?service=${service}&lines=1000`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            } else {
                setError(data.error || 'Failed to fetch logs');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Auto-refresh interval
    useEffect(() => {
        if (!user) return;
        fetchLogs();

        let intervalId: NodeJS.Timeout;
        if (autoRefresh) {
            intervalId = setInterval(() => {
                fetchLogs(true);
            }, 5000); // refresh every 5s
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [service, user, autoRefresh]);

    // Auto-scroll to bottom when new logs arrive (optional, but requested often for logs)
    useEffect(() => {
        if (logsEndRef.current && autoRefresh) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoRefresh]);

    if (!user) return null;

    const services = [
        { id: 'nextjs', name: 'WebUI (NextJS)' },
        { id: 'telegraf', name: 'Telegraf (Netflow)' },
        { id: 'clickhouse', name: 'Database (ClickHouse)' },
    ];

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row gap-8">
                <AdminSidebar />
                <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-slate-500/20 rounded-lg border border-slate-500/30">
                            <Terminal className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-100">System Logs</h1>
                            <p className="text-sm text-gray-500">View real-time component logs running in Docker</p>
                        </div>
                    </div>

                    <div className="bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden shadow-xl flex flex-col" style={{ height: '70vh' }}>
                        {/* Toolbar */}
                        <div className="border-b border-gray-800 bg-gray-900/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                {services.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setService(s.id)}
                                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${service === s.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                                            }`}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={autoRefresh}
                                        onChange={(e) => setAutoRefresh(e.target.checked)}
                                        className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 w-4 h-4"
                                    />
                                    Auto-refresh (5s)
                                </label>
                                <button
                                    onClick={() => fetchLogs()}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading && !autoRefresh ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {/* Log Viewer */}
                        <div className="flex-1 bg-[#0d1117] p-4 overflow-y-auto font-mono text-xs md:text-sm text-gray-300 relative">
                            {error ? (
                                <div className="flex items-center justify-center h-full text-red-400 gap-2">
                                    <AlertCircle className="w-5 h-5" /> {error}
                                </div>
                            ) : loading && !logs && !autoRefresh ? (
                                <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                                    <RefreshCw className="w-5 h-5 animate-spin" /> Fetching logs...
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap break-words">{logs}</pre>
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
