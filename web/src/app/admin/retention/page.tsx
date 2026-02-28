'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Database, ChevronLeft, Save, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AdminSidebar from '@/components/AdminSidebar';

export default function RetentionPage() {
    const router = useRouter();
    const [days, setDays] = useState('180');
    const [current, setCurrent] = useState('180');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(j => {
            if (!j.success || j.user?.role !== 'admin') { router.replace('/'); return; }
        });
        fetch('/api/admin/settings').then(r => r.json()).then(j => {
            if (j.success) { setDays(j.data.retention_days || '180'); setCurrent(j.data.retention_days || '180'); }
        });
    }, [router]);

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retention_days: days }) });
        // Apply TTL to ClickHouse table
        await fetch('/api/admin/apply-retention', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: Number(days) }) }).catch(() => { });
        setCurrent(days);
        setSaved(true);
        setSaving(false);
        setTimeout(() => setSaved(false), 3000);
    };

    const presets = [{ label: '7 days', val: '7' }, { label: '30 days', val: '30' }, { label: '90 days', val: '90' }, { label: '180 days', val: '180' }, { label: '365 days', val: '365' }];

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row gap-8">
                <AdminSidebar />
                <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                            <Database className="w-6 h-6 text-emerald-400" /> Data Retention
                        </h1>
                    </div>

                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-6">
                        <div>
                            <p className="text-sm text-gray-400 mb-1">Currently retaining data for <span className="text-emerald-400 font-medium">{current} days</span></p>
                            <p className="text-xs text-gray-600">Flow records older than this threshold are automatically deleted by ClickHouse TTL. Changes take effect within minutes.</p>
                        </div>

                        {/* Quick presets */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Quick Presets</label>
                            <div className="flex flex-wrap gap-2">
                                {presets.map(p => (
                                    <button key={p.val} onClick={() => setDays(p.val)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                                        ${days === p.val ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom input */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Custom (days)</label>
                            <div className="flex gap-3 items-center">
                                <input type="number" min="1" max="3650" value={days} onChange={e => setDays(e.target.value)}
                                    className="w-36 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-emerald-500" />
                                <span className="text-sm text-gray-500">days</span>
                            </div>
                        </div>

                        {Number(days) < 7 && (
                            <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                Very short retention — make sure this is intentional.
                            </div>
                        )}

                        <button onClick={handleSave} disabled={saving || days === current}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Apply Retention Policy'}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
