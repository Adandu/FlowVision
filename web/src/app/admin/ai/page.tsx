'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AdminSidebar from '@/components/AdminSidebar';
import { Sparkles, Key, CheckCircle, XCircle, Loader2, Save, ChevronDown } from 'lucide-react';

type Provider = 'gemini' | 'claude' | 'openai';

const providers: { id: Provider; name: string; logo: string; desc: string }[] = [
    { id: 'gemini', name: 'Google Gemini', logo: '✦', desc: 'Fast, efficient model from Google. Recommended.' },
    { id: 'claude', name: 'Anthropic Claude', logo: '◆', desc: 'Excellent at nuanced analysis and safety.' },
    { id: 'openai', name: 'OpenAI ChatGPT', logo: '◉', desc: 'Industry-standard with broad knowledge.' },
];

export default function AdminAIPage() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testStatus, setTestStatus] = useState<Record<Provider, 'idle' | 'loading' | 'ok' | 'error'>>({ gemini: 'idle', claude: 'idle', openai: 'idle' });
    const [saved, setSaved] = useState(false);

    const aiEnabled = settings.ai_enabled === 'true';
    const activeProvider = (settings.ai_provider || 'gemini') as Provider;

    useEffect(() => {
        fetch('/api/admin/settings')
            .then(r => r.json())
            .then(d => { if (d.success) setSettings(d.data); })
            .finally(() => setLoading(false));
    }, []);

    const updateSetting = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const testConnection = async (provider: Provider) => {
        const keyMap: Record<Provider, string> = {
            gemini: settings.ai_gemini_key,
            claude: settings.ai_claude_key,
            openai: settings.ai_openai_key,
        };
        if (!keyMap[provider]) {
            setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
            return;
        }
        setTestStatus(prev => ({ ...prev, [provider]: 'loading' }));
        // Save current key first then test
        await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ai_enabled: 'true', ai_provider: provider, [`ai_${provider}_key`]: keyMap[provider] }),
        });
        const res = await fetch(`/api/ai/summary?interval=1h&context=dashboard`);
        const data = await res.json();
        setTestStatus(prev => ({ ...prev, [provider]: data.summary ? 'ok' : 'error' }));
    };

    const keyForProvider = (p: Provider) => `ai_${p}_key`;

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row gap-8">
                <AdminSidebar />
                <div className="flex-1 space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-violet-400" /> AI Integration
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Connect an AI provider to get intelligent network traffic summaries on the Dashboard and IP pages.
                        </p>
                    </div>

                    {loading ? (
                        <div className="text-gray-500 flex items-center gap-2 py-8"><Loader2 className="animate-spin w-4 h-4" /> Loading settings...</div>
                    ) : (
                        <>
                            {/* Master Toggle */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-200">Enable AI Summaries</h3>
                                        <p className="text-gray-500 text-sm mt-0.5">Show AI-generated traffic insights on the Dashboard and IP pages</p>
                                    </div>
                                    <button
                                        onClick={() => updateSetting('ai_enabled', aiEnabled ? 'false' : 'true')}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiEnabled ? 'bg-violet-600' : 'bg-gray-700'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Provider Selection */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
                                <h3 className="text-base font-semibold text-gray-200 mb-4">Active AI Provider</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {providers.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => updateSetting('ai_provider', p.id)}
                                            className={`text-left p-4 rounded-xl border transition-all duration-200 ${activeProvider === p.id ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}
                                        >
                                            <div className="text-2xl mb-2">{p.logo}</div>
                                            <div className={`font-semibold text-sm ${activeProvider === p.id ? 'text-violet-300' : 'text-gray-300'}`}>{p.name}</div>
                                            <div className="text-xs text-gray-500 mt-1">{p.desc}</div>
                                            {activeProvider === p.id && (
                                                <div className="text-xs text-violet-400 mt-2 font-medium">✓ Active</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* API Keys */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                                <div className="p-6 border-b border-gray-800">
                                    <h3 className="text-base font-semibold text-gray-200">API Keys</h3>
                                    <p className="text-gray-500 text-sm mt-1">Keys are stored securely in ClickHouse and never exposed to the frontend.</p>
                                </div>
                                <div className="divide-y divide-gray-800">
                                    {providers.map(p => {
                                        const status = testStatus[p.id];
                                        const isActive = activeProvider === p.id;
                                        return (
                                            <div key={p.id} className={`p-6 ${isActive ? 'bg-violet-950/20' : ''}`}>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Key className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-300">{p.name}</span>
                                                    {isActive && <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded-full border border-violet-500/30">Active</span>}
                                                </div>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="password"
                                                        placeholder={`Enter your ${p.name} API key...`}
                                                        value={settings[keyForProvider(p.id)] || ''}
                                                        onChange={e => updateSetting(keyForProvider(p.id), e.target.value)}
                                                        className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg py-2 px-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                                                    />
                                                    <button
                                                        onClick={() => testConnection(p.id)}
                                                        disabled={status === 'loading'}
                                                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors flex items-center gap-2"
                                                    >
                                                        {status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                                        {status === 'ok' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                                                        {status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                                        {status === 'idle' && <Sparkles className="w-3.5 h-3.5" />}
                                                        Test
                                                    </button>
                                                </div>
                                                {status === 'ok' && <p className="text-xs text-emerald-400 mt-1.5">✓ Connection successful</p>}
                                                {status === 'error' && <p className="text-xs text-red-400 mt-1.5">✗ Connection failed — check your API key</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-violet-500/20"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saved ? 'Saved!' : 'Save Settings'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
