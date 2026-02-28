'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { Settings, Users, ArrowLeft, Database, Activity, MonitorCog, Play, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminTasksPage() {
    const [running, setRunning] = useState<string | null>(null);
    const [results, setResults] = useState<{ [key: string]: { success: boolean; message: string } }>({});

    const runOptimization = async (table: string, name: string) => {
        if (!confirm(`Are you sure you want to run optimization for ${name}? This may cause temporary high CPU usage.`)) return;

        setRunning(table);
        try {
            const res = await fetch('/api/admin/tasks/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table })
            });
            const data = await res.json();
            setResults(prev => ({ ...prev, [table]: { success: data.success, message: data.message || data.error } }));
        } catch (e) {
            setResults(prev => ({ ...prev, [table]: { success: false, message: 'Network error occurred' } }));
        } finally {
            setRunning(null);
        }
    };

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
                            <Link href="/admin/metrics" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                                <Activity className="w-4 h-4 text-pink-400" /> Metrics
                            </Link>
                            <Link href="/admin/tasks" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 bg-amber-500/10 transition-colors">
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
                            <Database className="w-6 h-6 text-amber-400" /> Database Maintenance Tasks
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Manually trigger scheduled system tasks and database optimizations. Wait times may vary.
                        </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-gray-800">
                            <h3 className="text-lg font-semibold text-gray-200 mb-1">ClickHouse Table Optimization</h3>
                            <p className="text-sm text-gray-400 mb-6">
                                Running OPTIMIZE TABLE forces the database engine to merge data parts in the background, which sweeps expired rows (TTL) and reclaims disk space.
                            </p>

                            <div className="space-y-4">
                                {[
                                    { table: 'flows', name: 'Raw Flows logs', desc: 'Main telemetry table storing actual flows.' },
                                    { table: 'flows_1m_mv', name: '1-Minute Aggregations', desc: 'Materialized view for dashboard charts.' },
                                    { table: 'flows_1h_mv', name: '1-Hour Aggregations', desc: 'Materialized view for long-term trending.' },
                                ].map((task) => (
                                    <div key={task.table} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-colors">
                                        <div>
                                            <h4 className="font-medium text-gray-200">{task.name}</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">{task.desc} (<span className="font-mono text-amber-400/80">{task.table}</span>)</p>
                                        </div>
                                        <div className="mt-4 sm:mt-0 flex items-center gap-4">
                                            {results[task.table] && (
                                                <div className={`text-sm flex items-center gap-1.5 ${results[task.table].success ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {results[task.table].success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                    {results[task.table].message}
                                                </div>
                                            )}
                                            <button
                                                onClick={() => runOptimization(task.table, task.name)}
                                                disabled={running !== null}
                                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]"
                                            >
                                                {running === task.table ? (
                                                    <><Activity className="w-4 h-4 animate-spin" /> Running...</>
                                                ) : (
                                                    <><Play className="w-4 h-4 fill-current" /> Run Now</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
