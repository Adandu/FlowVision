'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Save, Lock, Globe, Languages } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useTimezone, TIMEZONE_LIST, type TZEntry } from '@/lib/timezone';

const LANGUAGES = [
    { value: 'en', label: '🇬🇧 English' },
    { value: 'fr', label: '🇫🇷 Français (coming soon)' },
    { value: 'de', label: '🇩🇪 Deutsch (coming soon)' },
    { value: 'es', label: '🇪🇸 Español (coming soon)' },
    { value: 'el', label: '🇬🇷 Ελληνικά (coming soon)' },
];

export default function ProfilePage() {
    const router = useRouter();
    const { timezone, setTimezone } = useTimezone();
    const [user, setUser] = useState<any>(null);
    const [form, setForm] = useState({ display_name: '', language: 'en', timezone: 'UTC' });
    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPw, setSavingPw] = useState(false);
    const [profileMsg, setProfileMsg] = useState('');
    const [pwMsg, setPwMsg] = useState('');
    const [pwError, setPwError] = useState('');

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(j => {
            if (!j.success) { router.replace('/login'); return; }
            setUser(j.user);
            setForm({ display_name: j.user.display_name || '', language: j.user.language || 'en', timezone: j.user.timezone || timezone });
        });
    }, [router]);

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        setTimezone(form.timezone); // Also update live context
        setProfileMsg('Profile saved!');
        setSavingProfile(false);
        setTimeout(() => setProfileMsg(''), 3000);
    };

    const savePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError('');
        if (pwForm.new_password !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
        setSavingPw(true);
        const res = await fetch('/api/profile/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pwForm) });
        const j = await res.json();
        if (j.success) { setPwMsg('Password changed!'); setPwForm({ current_password: '', new_password: '', confirm: '' }); }
        else setPwError(j.error || 'Failed to change password');
        setSavingPw(false);
        setTimeout(() => setPwMsg(''), 3000);
    };

    if (!user) return null;

    const initials = (form.display_name || user.username || '?').slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                        {initials}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-100">{form.display_name || user.username}</h1>
                        <p className="text-sm text-gray-500">@{user.username} · <span className="capitalize">{user.role}</span></p>
                    </div>
                </div>

                {/* Profile Info */}
                <form onSubmit={saveProfile} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
                    <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2"><User className="w-4 h-4 text-blue-400" />Personal Info & Preferences</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Display Name</label>
                            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Email</label>
                            <input value={user.email || ''} disabled className="w-full px-3 py-2 bg-gray-800/50 border border-gray-800 rounded-lg text-sm text-gray-500 cursor-not-allowed" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Languages className="w-3 h-3" />Interface Language</label>
                            <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500">
                                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Globe className="w-3 h-3" />Default Timezone</label>
                            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500 max-h-40">
                                {TIMEZONE_LIST.map((tz: TZEntry) => <option key={tz.zone} value={tz.zone}>{tz.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={savingProfile}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                            <Save className="w-4 h-4" /> {savingProfile ? 'Saving…' : 'Save Profile'}
                        </button>
                        {profileMsg && <span className="text-emerald-400 text-sm">{profileMsg}</span>}
                    </div>
                </form>

                {/* Change Password */}
                <form onSubmit={savePassword} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
                    <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" />Change Password</h2>
                    {[['current_password', 'Current Password'], ['new_password', 'New Password (min 8 chars)'], ['confirm', 'Confirm New Password']].map(([k, l]) => (
                        <div key={k}>
                            <label className="block text-xs text-gray-400 mb-1">{l}</label>
                            <input type="password" value={(pwForm as any)[k]} onChange={e => setPwForm(f => ({ ...f, [k]: e.target.value }))} required
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-amber-500" />
                        </div>
                    ))}
                    {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={savingPw}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                            <Lock className="w-4 h-4" /> {savingPw ? 'Changing…' : 'Change Password'}
                        </button>
                        {pwMsg && <span className="text-emerald-400 text-sm">{pwMsg}</span>}
                    </div>
                </form>
            </main>
        </div>
    );
}
