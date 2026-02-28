'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, PlusCircle, Trash2, ChevronLeft, CheckCircle, XCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import Navbar from '@/components/Navbar';

const CHANNEL_TYPES = [
    { value: 'discord', label: '🎮 Discord', fields: [{ k: 'webhook_url', l: 'Webhook URL', ph: 'https://discord.com/api/webhooks/...' }] },
    { value: 'ntfy', label: '📣 NTFY', fields: [{ k: 'url', l: 'Server URL', ph: 'https://ntfy.sh' }, { k: 'topic', l: 'Topic', ph: 'my-alerts' }, { k: 'token', l: 'Access Token (optional)', ph: '' }] },
    { value: 'slack', label: '💼 Slack', fields: [{ k: 'webhook_url', l: 'Webhook URL', ph: 'https://hooks.slack.com/...' }] },
    { value: 'telegram', label: '✈️ Telegram', fields: [{ k: 'bot_token', l: 'Bot Token', ph: '1234567890:ABC...' }, { k: 'chat_id', l: 'Chat ID', ph: '-1001234567890' }] },
    { value: 'email', label: '📧 Email (SMTP)', fields: [{ k: 'smtp_host', l: 'Host', ph: 'smtp.gmail.com' }, { k: 'smtp_port', l: 'Port', ph: '587' }, { k: 'smtp_user', l: 'Username', ph: '' }, { k: 'smtp_pass', l: 'Password', ph: '' }, { k: 'from', l: 'From Address', ph: 'alerts@example.com' }, { k: 'to', l: 'To Address', ph: 'admin@example.com' }] },
    { value: 'webhook', label: '🔗 Webhook', fields: [{ k: 'url', l: 'URL', ph: 'https://example.com/hook' }, { k: 'method', l: 'HTTP Method (POST/PUT)', ph: 'POST' }] },
    { value: 'apprise', label: '📦 Apprise', fields: [{ k: 'url', l: 'Apprise API URL', ph: 'http://apprise:8000' }, { k: 'tag', l: 'Tag (optional)', ph: 'flowvision' }] },
];

export default function AdminNotificationsPage() {
    const router = useRouter();
    const [channels, setChannels] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', type: 'discord', config: {} as Record<string, string> });
    const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string } | null>>({});
    const [testing, setTesting] = useState<Record<string, boolean>>({});

    const load = () => {
        fetch('/api/admin/notifications').then(r => r.json()).then(j => { if (j.success) setChannels(j.data); });
    };

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(j => { if (!j.success || j.user?.role !== 'admin') { router.replace('/'); return; } load(); });
    }, [router]);

    const selectedType = CHANNEL_TYPES.find(t => t.value === form.type);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, type: form.type, config: form.config }) });
        setShowForm(false); setForm({ name: '', type: 'discord', config: {} }); load();
    };

    const handleTest = async (id: string, channel?: any) => {
        const target = channel || channels.find(c => c.id === id);
        if (!target) return;
        setTesting(t => ({ ...t, [id]: true }));
        try {
            const res = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', name: target.name, type: target.type, config: target.config }) });
            const j = await res.json();
            setTestResults(r => ({ ...r, [id]: { ok: j.success, msg: j.message || j.error || '' } }));
        } catch { setTestResults(r => ({ ...r, [id]: { ok: false, msg: 'Network error' } })); }
        setTesting(t => ({ ...t, [id]: false }));
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this channel?')) return;
        await fetch(`/api/admin/notifications?id=${id}`, { method: 'DELETE' }); load();
    };

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="text-gray-500 hover:text-gray-300 transition-colors"><ChevronLeft className="w-5 h-5" /></Link>
                        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2"><Bell className="w-6 h-6 text-amber-400" /> Notification Channels</h1>
                    </div>
                    <button onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors">
                        <PlusCircle className="w-4 h-4" /> Add Channel
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleCreate} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
                        <h2 className="text-base font-semibold text-gray-200">New Notification Channel</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Channel Name *</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="My Discord Alert"
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-amber-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Type *</label>
                                <select value={form.type} onChange={e => { setForm(f => ({ ...f, type: e.target.value, config: {} })); }}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-amber-500">
                                    {CHANNEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedType?.fields.map(f => (
                                <div key={f.k}>
                                    <label className="block text-xs text-gray-400 mb-1">{f.l}</label>
                                    <input value={form.config[f.k] || ''} onChange={e => setForm(fm => ({ ...fm, config: { ...fm.config, [f.k]: e.target.value } }))}
                                        placeholder={f.ph} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
                            <button type="button" onClick={() => handleTest('new-form', { name: form.name, type: form.type, config: form.config })} disabled={testing['new-form']}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors">
                                <Send className="w-3.5 h-3.5" /> {testing['new-form'] ? 'Testing…' : 'Test'}
                            </button>
                            {testResults['new-form'] && (
                                <span className={`flex items-center gap-1 text-sm ${testResults['new-form'].ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {testResults['new-form'].ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                    {testResults['new-form'].msg}
                                </span>
                            )}
                            <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors">Save Channel</button>
                        </div>
                    </form>
                )}

                <div className="space-y-3">
                    {channels.length === 0 && <div className="text-center py-12 text-gray-500 bg-gray-900/30 border border-gray-800 rounded-xl text-sm">No notification channels configured.</div>}
                    {channels.map(ch => (
                        <div key={ch.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center text-lg">
                                    {CHANNEL_TYPES.find(t => t.value === ch.type)?.label.split(' ')[0] || '🔔'}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-200">{ch.name}</p>
                                    <p className="text-xs text-gray-500 capitalize">{ch.type}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {testResults[ch.id] && (
                                    <span className={`flex items-center gap-1 text-xs ${testResults[ch.id]?.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {testResults[ch.id]?.ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                        {testResults[ch.id]?.msg}
                                    </span>
                                )}
                                <button onClick={() => handleTest(ch.id)} disabled={testing[ch.id]}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors">
                                    <Send className="w-3 h-3" /> {testing[ch.id] ? '…' : 'Test'}
                                </button>
                                <button onClick={() => handleDelete(ch.id)} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
