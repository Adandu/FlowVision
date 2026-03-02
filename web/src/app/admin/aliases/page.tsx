'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AdminSidebar from '@/components/AdminSidebar';
import Link from 'next/link';
import { Settings, Users, ArrowLeft, Database, Save, Trash2, Plus, MonitorCog, Activity } from 'lucide-react';

export default function AdminAliasesPage() {
    const [aliases, setAliases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newIp, setNewIp] = useState('');
    const [newAlias, setNewAlias] = useState('');
    const [error, setError] = useState('');

    const fetchAliases = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/aliases');
            const data = await res.json();
            if (data.success) {
                setAliases(data.aliases);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAliases();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!newIp || !newAlias) return;

        // Basic IPv4 / IPv6 validation
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})$/;
        if (!ipRegex.test(newIp)) {
            setError('Please enter a valid IPv4 or IPv6 address.');
            return;
        }

        try {
            const res = await fetch('/api/admin/aliases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: newIp, alias: newAlias })
            });

            const data = await res.json();
            if (!data.success) {
                setError(data.error || 'Failed to save alias');
            } else {
                setNewIp('');
                setNewAlias('');
                fetchAliases();
            }
        } catch (e) {
            setError('Network error');
        }
    };

    const handleDelete = async (ip: string) => {
        if (!confirm(`Delete alias for ${ip}?`)) return;

        try {
            const res = await fetch(`/api/admin/aliases?ip=${encodeURIComponent(ip)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                fetchAliases();
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row gap-8">

                {/* Admin Sidebar */}
                <AdminSidebar />

                {/* Main Content */}
                <div className="flex-1 space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                            <MonitorCog className="w-6 h-6 text-blue-400" /> Custom IP Aliases
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Assign memorable names to IP addresses (e.g. MyServer) across the application.
                        </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-gray-800">
                            <h3 className="text-lg font-semibold text-gray-200 mb-4">Add New Alias</h3>

                            {error && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 font-medium mb-1">IP Address</label>
                                    <input
                                        type="text"
                                        placeholder="192.168.1.1"
                                        value={newIp}
                                        onChange={e => setNewIp(e.target.value)}
                                        className="w-full bg-gray-800 border-gray-700 text-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 font-medium mb-1">Custom Name</label>
                                    <input
                                        type="text"
                                        placeholder="MyServer"
                                        value={newAlias}
                                        onChange={e => setNewAlias(e.target.value)}
                                        className="w-full bg-gray-800 border-gray-700 text-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button type="submit" disabled={!newIp || !newAlias} className="h-[42px] px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20">
                                        <Save className="w-4 h-4" /> Save
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-3">IP Address</th>
                                        <th className="px-6 py-3">Alias</th>
                                        <th className="px-6 py-3">Last Updated</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 border-t border-gray-800">
                                    {loading && (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading aliases...</td></tr>
                                    )}
                                    {!loading && aliases.length === 0 && (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No custom aliases defined.</td></tr>
                                    )}
                                    {!loading && aliases.map((alias) => (
                                        <tr key={alias.ip} className="hover:bg-gray-800/30">
                                            <td className="px-6 py-4 font-mono text-gray-300">{alias.ip}</td>
                                            <td className="px-6 py-4 font-semibold text-blue-400">{alias.alias}</td>
                                            <td className="px-6 py-4 text-gray-500">{alias.updated_at}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(alias.ip)}
                                                    className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
