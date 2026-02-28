'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Globe, ChevronLeft, Save, ExternalLink } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function OidcPage() {
    const router = useRouter();
    const [cfg, setCfg] = useState({ oidc_enabled: '0', oidc_provider_url: '', oidc_client_id: '', oidc_client_secret: '', oidc_scopes: 'openid profile email' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(j => { if (!j.success || j.user?.role !== 'admin') { router.replace('/'); return; } });
        fetch('/api/admin/settings').then(r => r.json()).then(j => { if (j.success) setCfg(c => ({ ...c, ...j.data })); });
    }, [router]);

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
        setSaved(true); setSaving(false); setTimeout(() => setSaved(false), 3000);
    };

    const field = (key: keyof typeof cfg, label: string, placeholder = '', type = 'text') => (
        <div key={key}>
            <label className="block text-xs text-gray-400 mb-1">{label}</label>
            <input type={type} value={cfg[key]} onChange={e => setCfg(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/admin" className="text-gray-500 hover:text-gray-300 transition-colors"><ChevronLeft className="w-5 h-5" /></Link>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Globe className="w-6 h-6 text-purple-400" /> OIDC / SSO
                    </h1>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300 flex gap-3">
                    <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        For proxy-based OIDC (Authelia/Authentik), set <code className="bg-blue-500/20 px-1 rounded font-mono text-xs">AUTH_MODE=proxy</code> and configure your reverse proxy to forward the <code className="bg-blue-500/20 px-1 rounded font-mono text-xs">Remote-User</code> header. The settings below are for future native OIDC support.
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-300">Enable Native OIDC</span>
                        <button onClick={() => setCfg(c => ({ ...c, oidc_enabled: c.oidc_enabled === '1' ? '0' : '1' }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cfg.oidc_enabled === '1' ? 'bg-purple-500' : 'bg-gray-700'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cfg.oidc_enabled === '1' ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {cfg.oidc_enabled === '1' && (
                        <div className="space-y-4 pt-2 border-t border-gray-800">
                            {field('oidc_provider_url', 'Provider URL', 'https://auth.example.com')}
                            {field('oidc_client_id', 'Client ID', 'flowvision')}
                            {field('oidc_client_secret', 'Client Secret', '', 'password')}
                            {field('oidc_scopes', 'Scopes', 'openid profile email')}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Redirect URI (configure in your OIDC provider)</label>
                                <code className="text-xs text-gray-400 bg-gray-800 px-3 py-2 rounded-lg block font-mono">
                                    {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/auth/callback
                                </code>
                            </div>
                        </div>
                    )}

                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save OIDC Settings'}
                    </button>
                </div>
            </main>
        </div>
    );
}
