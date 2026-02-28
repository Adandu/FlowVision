'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, Users, Database, Globe, Bell, ChevronRight, Shield, Server } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(j => {
            if (!j.success || j.user?.role !== 'admin') { router.replace('/'); return; }
            setUser(j.user);
        });
    }, [router]);

    const sections = [
        { href: '/admin/users', icon: <Users className="w-6 h-6 text-emerald-400" />, title: 'Users & Auth', desc: 'Manage user accounts, roles, and access groups' },
        { href: '/admin/aliases', icon: <Server className="w-6 h-6 text-blue-400" />, title: 'IP Aliases', desc: 'Assign custom names to private network IPs' },
        { href: '/admin/metrics', icon: <Globe className="w-6 h-6 text-pink-400" />, title: 'System Metrics', desc: 'Live CPU, RAM and Database Storage telemetry' },
        { href: '/admin/tasks', icon: <Database className="w-6 h-6 text-amber-400" />, title: 'Scheduled Tasks', desc: 'Database maintenance, cleanup and optimizations' },
        { href: '/admin/retention', icon: <Settings className="w-6 h-6 text-slate-400" />, title: 'Data Retention', desc: 'Configure how long flow data is kept in ClickHouse' },
    ];

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row gap-8">
                <AdminSidebar />
                <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
                            <Shield className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-100">Admin Panel</h1>
                            <p className="text-sm text-gray-500">System configuration and management</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sections.map(s => (
                            <Link key={s.href} href={s.href}
                                className="group flex items-center gap-4 p-5 bg-gray-900/50 border border-gray-800 hover:border-gray-700 rounded-xl transition-all hover:shadow-lg hover:bg-gray-900/80">
                                <div className="p-3 bg-gray-800 rounded-lg group-hover:scale-105 transition-transform">{s.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-200">{s.title}</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 transition-colors" />
                            </Link>
                        ))}
                    </div>

                    {/* System info */}
                    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-5">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Server className="w-4 h-4" />System</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><p className="text-gray-500 text-xs mb-1">Version</p><p className="text-gray-200 font-mono">1.0.0</p></div>
                            <div><p className="text-gray-500 text-xs mb-1">Auth Mode</p><p className="text-gray-200 font-mono">{process.env.AUTH_MODE || 'env-var'}</p></div>
                            <div><p className="text-gray-500 text-xs mb-1">Database</p><p className="text-gray-200 font-mono">ClickHouse</p></div>
                            <div><p className="text-gray-500 text-xs mb-1">Runtime</p><p className="text-gray-200 font-mono">Next.js 16</p></div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
