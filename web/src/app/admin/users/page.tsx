'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, PlusCircle, Trash2, ChevronLeft, UserCheck, UserX, Crown, Settings } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [guestMode, setGuestMode] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '', role: 'viewer' });

    const loadUsersAndSettings = async () => {
        setLoading(true);
        try {
            const [usersRes, settingsRes] = await Promise.all([
                fetch('/api/admin/users').then(r => r.json()),
                fetch('/api/admin/settings').then(r => r.json())
            ]);

            if (usersRes.success) {
                setUsers(usersRes.data);
            }
            if (settingsRes.success) {
                setGuestMode(settingsRes.settings?.guest_mode_enabled === '1');
            }
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(j => {
            if (!j.success || j.user?.role !== 'admin') { router.replace('/'); return; }
            loadUsersAndSettings();
        });
    }, [router]);

    const toggleGuestMode = async () => {
        setSaving(true);
        const newValue = !guestMode;
        setGuestMode(newValue);
        try {
            await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guest_mode_enabled: newValue ? '1' : '0' })
            });
        } catch (error) {
            console.error("Failed to toggle guest mode:", error);
            setGuestMode(!newValue); // Revert if API call fails
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        setShowForm(false);
        setForm({ username: '', email: '', password: '', display_name: '', role: 'viewer' });
        loadUsersAndSettings();
    };

    const handleDelete = async (id: string, username: string) => {
        if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
        await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
        loadUsersAndSettings();
    };

    const handleToggleActive = async (user: any) => {
        await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, role: user.role, is_active: user.is_active ? 0 : 1 }) });
        loadUsersAndSettings();
    };

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row gap-8">
                <AdminSidebar />
                <div className="flex-1 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/admin" className="text-gray-500 hover:text-gray-300 transition-colors"><ChevronLeft className="w-5 h-5" /></Link>
                            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2"><Users className="w-6 h-6 text-blue-400" />Users</h1>
                        </div>
                        <button onClick={() => setShowForm(!showForm)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors">
                            <PlusCircle className="w-4 h-4" /> New User
                        </button>
                    </div>

                    {showForm && (
                        <form onSubmit={handleCreate} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
                            <h2 className="text-base font-semibold text-gray-200">Create New User</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[['username', 'Username *'], ['display_name', 'Display Name'], ['email', 'Email']].map(([k, label]) => (
                                    <div key={k}>
                                        <label className="block text-xs text-gray-400 mb-1">{label}</label>
                                        <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} required={k === 'username'}
                                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Password *</label>
                                    <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Role</label>
                                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500">
                                        <option value="viewer">Viewer</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">Create User</button>
                            </div>
                        </form>
                    )}

                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl">
                        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2 mb-6">
                            <Settings className="w-5 h-5 text-purple-400" /> Global Settings
                        </h2>

                        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                            <div>
                                <h3 className="font-semibold text-gray-200">Public Guest Mode</h3>
                                <p className="text-sm text-gray-500 mt-1">If enabled, anyone can view the dashboard without logging in. IP addresses will be obfuscated to protect privacy.</p>
                            </div>
                            <button
                                onClick={toggleGuestMode}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${guestMode ? 'bg-emerald-500' : 'bg-gray-700'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${guestMode ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                        {loading ? <p className="p-6 text-gray-500 animate-pulse">Loading…</p> : (
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-gray-800 bg-gray-900/60">
                                    {['User', 'Email', 'Role', 'Status', 'Last Login', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
                                                        {(u.display_name || u.username).slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-200">{u.display_name || u.username}</p>
                                                        <p className="text-xs text-gray-500">@{u.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400">{u.email || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`flex items-center gap-1 w-fit text-xs font-medium px-2 py-0.5 rounded-full
                                                ${u.role === 'admin' ? 'text-amber-400 bg-amber-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
                                                    {u.role === 'admin' && <Crown className="w-3 h-3" />} {u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`flex items-center gap-1 text-xs ${u.is_active ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                    {u.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                                    {u.is_active ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleToggleActive(u)} title={u.is_active ? 'Disable' : 'Enable'}
                                                        className={`text-xs px-2 py-1 rounded border transition-colors
                                                        ${u.is_active ? 'border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-500/30' : 'border-gray-700 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30'}`}>
                                                        {u.is_active ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button onClick={() => handleDelete(u.id, u.username)} className="text-gray-500 hover:text-red-400 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
