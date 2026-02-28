'use client';

import { useState, useEffect } from 'react';
import { Bell, PlusCircle, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/Navbar';

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.max(1, bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const ALERT_TYPES = [
    { value: 'bandwidth_threshold', label: 'Bandwidth Threshold (bytes/min)' },
    { value: 'new_ip', label: 'New Unknown IP Detected' },
    { value: 'high_flow_count', label: 'High Flow Count (flows/min)' },
];

export default function AlertsPage() {
    const [data, setData] = useState<any>({ rules: [], events: [] });
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', type: 'bandwidth_threshold', threshold: '' });
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        fetch('/api/alerts')
            .then(r => r.json())
            .then(j => { if (j.success) setData(j.data); })
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await fetch('/api/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, threshold: Number(form.threshold) }),
        });
        setSaving(false);
        setShowForm(false);
        setForm({ name: '', type: 'bandwidth_threshold', threshold: '' });
        load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this alert rule?')) return;
        await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Bell className="w-6 h-6 text-amber-400" /> Alert Rules
                    </h1>
                    <button onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors">
                        <PlusCircle className="w-4 h-4" /> New Alert
                    </button>
                </div>

                {/* Create Form */}
                {showForm && (
                    <form onSubmit={handleCreate} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
                        <h2 className="text-base font-semibold text-gray-200">New Alert Rule</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Name</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                                    placeholder="High bandwidth alert"
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Type</label>
                                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500">
                                    {ALERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Threshold</label>
                                <input value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} type="number" required
                                    placeholder="e.g. 10000000"
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                                {saving ? 'Saving…' : 'Create Alert'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Rules Table */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-base font-semibold text-gray-200 mb-4">Configured Rules</h2>
                    {loading
                        ? <p className="text-gray-500 text-sm animate-pulse">Loading…</p>
                        : data.rules.length === 0
                            ? <p className="text-gray-500 text-sm">No alert rules configured. Create one above.</p>
                            : <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                                        <th className="px-4 py-2 text-left">Name</th>
                                        <th className="px-4 py-2 text-left">Type</th>
                                        <th className="px-4 py-2 text-left">Threshold</th>
                                        <th className="px-4 py-2 text-left">Triggers</th>
                                        <th className="px-4 py-2 text-left">Status</th>
                                        <th className="px-4 py-2" />
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {data.rules.map((rule: any) => (
                                            <tr key={rule.id} className="hover:bg-gray-800/30">
                                                <td className="px-4 py-3 text-gray-200 font-medium">{rule.name}</td>
                                                <td className="px-4 py-3 text-gray-400">{ALERT_TYPES.find(t => t.value === rule.type)?.label || rule.type}</td>
                                                <td className="px-4 py-3 text-gray-400">{rule.type === 'bandwidth_threshold' ? formatBytes(Number(rule.threshold)) : rule.threshold}</td>
                                                <td className="px-4 py-3 text-gray-400">{rule.trigger_count}</td>
                                                <td className="px-4 py-3">
                                                    {rule.enabled ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3 h-3" /> Active</span>
                                                        : <span className="flex items-center gap-1 text-gray-500 text-xs">Disabled</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button onClick={() => handleDelete(rule.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    }
                </div>

                {/* Recent Events */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" /> Recent Triggers
                    </h2>
                    {loading
                        ? <p className="text-gray-500 text-sm animate-pulse">Loading…</p>
                        : data.events.length === 0
                            ? <p className="text-gray-500 text-sm">No alerts have been triggered yet.</p>
                            : <div className="space-y-2">
                                {data.events.map((ev: any) => (
                                    <div key={ev.id} className="flex items-center gap-3 py-2 border-b border-gray-800/50">
                                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                        <span className="text-sm font-medium text-gray-200">{ev.alert_name}</span>
                                        <span className="text-sm text-gray-400">{ev.message}</span>
                                        <span className="text-xs text-gray-500 ml-auto">{new Date(ev.triggered_at).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                    }
                </div>
            </main>
        </div>
    );
}
