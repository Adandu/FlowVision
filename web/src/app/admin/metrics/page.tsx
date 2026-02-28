'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { Settings, Users, ArrowLeft, Database, Activity, MonitorCog, Server, HardDrive, Cpu, Clock } from 'lucide-react';

function formatBytes(bytes: number) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.max(1, bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AdminMetricsPage() {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/metrics');
            const data = await res.json();
            if (data.success) {
                setMetrics(data.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        const timer = setInterval(fetchMetrics, 10000); // Poll every 10s
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row gap-8">

                {/* Admin Sidebar */}
                <div className="w-full md:w-64 flex-shrink-0">
                    <Link href="/admin" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-6 transition-colors w-fit">
                        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </Link>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-gray-800 bg-gray-800/50">
                            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Admin Panel</h2>
                        </div>
                        <nav className="p-2 space-y-1">
                            <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                                <Users className="w-4 h-4 text-emerald-400" /> Users & Auth
                            </Link>
                            <Link href="/admin/aliases" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                                <MonitorCog className="w-4 h-4 text-blue-400" /> IP Aliases
                            </Link>
                            <Link href="/admin/metrics" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-pink-400 bg-pink-500/10 transition-colors">
                                <Activity className="w-4 h-4 text-pink-400" /> Metrics
                            </Link>
                            <Link href="/admin/tasks" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                                <Database className="w-4 h-4 text-amber-400" /> Scheduled Tasks
                            </Link>
                            <Link href="/admin/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                                <Settings className="w-4 h-4 text-gray-400" /> Access Logs
                            </Link>
                        </nav>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                            <Activity className="w-6 h-6 text-pink-400" /> System Metrics
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Live health and performance statistics for the Node.js application container and ClickHouse database.
                        </p>
                    </div>

                    {loading && !metrics && (
                        <div className="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
                            <Activity className="w-4 h-4 animate-spin" /> Gathering system telemetry...
                        </div>
                    )}

                    {metrics && (
                        <>
                            {/* App Container Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Cpu className="w-16 h-16 text-blue-400" /></div>
                                    <h3 className="text-gray-400 text-sm font-semibold mb-2">CPU Load</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-gray-100">{metrics.system.loadAvg[0].toFixed(2)}</span>
                                        <span className="text-sm text-gray-500">1m avg</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">{metrics.system.cpuCount} Cores Available</p>
                                </div>

                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><HardDrive className="w-16 h-16 text-emerald-400" /></div>
                                    <h3 className="text-gray-400 text-sm font-semibold mb-2">System Memory</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-gray-100">{formatBytes(metrics.system.memory.used)}</span>
                                        <span className="text-sm text-gray-500">/ {formatBytes(metrics.system.memory.total)}</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-4">
                                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${metrics.system.memory.percentUsed}%` }}></div>
                                    </div>
                                </div>

                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Server className="w-16 h-16 text-purple-400" /></div>
                                    <h3 className="text-gray-400 text-sm font-semibold mb-2">Container Platform</h3>
                                    <p className="text-xl font-medium text-gray-200">{metrics.system.platform} {metrics.system.release}</p>
                                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Uptime: {Math.floor(metrics.system.uptime / 3600)}h {Math.floor((metrics.system.uptime % 3600) / 60)}m
                                    </p>
                                </div>
                            </div>

                            {/* ClickHouse Stats */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                                            <Database className="w-5 h-5 text-amber-400" /> Database Storage
                                        </h3>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Total Size: <span className="text-white font-medium">{formatBytes(metrics.database.totalBytes)}</span> across <span className="text-white font-medium">{(metrics.database.totalRows).toLocaleString()}</span> rows.
                                        </p>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <span className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded">{metrics.database.version}</span>
                                        <p className="text-xs text-gray-500 mt-1">Uptime: {Math.floor(metrics.database.uptime / 3600)}h</p>
                                    </div>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase">
                                        <tr>
                                            <th className="px-6 py-3">Table Name</th>
                                            <th className="px-6 py-3 text-right">Rows</th>
                                            <th className="px-6 py-3 text-right">Size on Disk</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800 text-gray-300">
                                        {metrics.database.tables.map((table: any) => (
                                            <tr key={table.name} className="hover:bg-gray-800/30">
                                                <td className="px-6 py-4 font-mono text-blue-400">{table.name}</td>
                                                <td className="px-6 py-4 text-right font-mono">{table.rows.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right">{formatBytes(table.bytes)}</td>
                                            </tr>
                                        ))}
                                        {metrics.database.tables.length === 0 && (
                                            <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">No active parts in database.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
