'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Globe, ChevronDown, User, LogOut, Settings, LayoutDashboard, List, Bell, Network, Menu, X } from 'lucide-react';
import { useTimezone, TIMEZONE_LIST, type TZEntry } from '@/lib/timezone';

export default function Navbar() {
    const { timezone, setTimezone } = useTimezone();
    const [tzOpen, setTzOpen] = useState(false);
    const [userOpen, setUserOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [tzSearch, setTzSearch] = useState('');
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(j => { if (j?.success) setUser(j.user); }).catch(() => { });
    }, []);

    const filteredZones = TIMEZONE_LIST.filter(e =>
        tzSearch === '' || e.label.toLowerCase().includes(tzSearch.toLowerCase())
    );

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    const initials = user?.display_name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        || user?.username?.slice(0, 2).toUpperCase() || '??';

    return (
        <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
            <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center space-x-3">
                        <div className="bg-blue-500/20 p-2 rounded-lg">
                            <Activity className="h-6 w-6 text-blue-400" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                            FlowVision
                        </span>
                    </div>

                    {/* Desktop Nav links */}
                    <div className="hidden md:flex items-center space-x-1">
                        <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
                            <LayoutDashboard className="w-4 h-4" /> Dashboard
                        </Link>
                        <Link href="/flow-log" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
                            <List className="w-4 h-4" /> Flow Log
                        </Link>
                        <Link href="/ip" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
                            <Globe className="w-4 h-4" /> IP Search
                        </Link>
                        <Link href="/alerts" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
                            <Bell className="w-4 h-4" /> Alerts
                        </Link>
                        {user?.role === 'admin' && (
                            <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-all">
                                <Settings className="w-4 h-4" /> Admin
                            </Link>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Timezone selector */}
                        <div className="relative">
                            <button onClick={() => { setTzOpen(!tzOpen); setUserOpen(false); setMobileOpen(false); }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-700 transition-all">
                                <Globe className="w-4 h-4 text-blue-400" />
                                <span className="max-w-[130px] truncate hidden sm:block">{timezone}</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${tzOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {tzOpen && (
                                <div className="absolute right-0 top-full mt-1 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 flex flex-col max-h-80">
                                    <div className="p-2 border-b border-gray-800">
                                        <input value={tzSearch} onChange={e => setTzSearch(e.target.value)} placeholder="Search timezone…"
                                            className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="overflow-y-auto flex-1">
                                        {filteredZones.map((tz: TZEntry) => (
                                            <button key={tz.zone} onClick={() => { setTimezone(tz.zone); setTzOpen(false); setTzSearch(''); }}
                                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${timezone === tz.zone ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                                                {tz.label}
                                            </button>
                                        ))}
                                        {filteredZones.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No matches</p>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User menu */}
                        {user && (
                            <div className="relative">
                                <button onClick={() => { setUserOpen(!userOpen); setTzOpen(false); setMobileOpen(false); }}
                                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-800 transition-all">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white">
                                        {initials}
                                    </div>
                                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${userOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {userOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">
                                        <div className="px-4 py-3 border-b border-gray-800">
                                            <p className="text-sm font-medium text-gray-200">{user.display_name || user.username}</p>
                                            <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                                        </div>
                                        <div className="py-1">
                                            <Link href="/profile" onClick={() => setUserOpen(false)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                                                <User className="w-4 h-4" /> Profile
                                            </Link>
                                            {user.role === 'admin' && (
                                                <Link href="/admin" onClick={() => setUserOpen(false)}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                                                    <Settings className="w-4 h-4" /> Admin Panel
                                                </Link>
                                            )}
                                            <button onClick={handleLogout}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                                                <LogOut className="w-4 h-4" /> Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mobile Hamburger Toggle */}
                        <div className="md:hidden ml-2 flex items-center">
                            <button onClick={() => { setMobileOpen(!mobileOpen); setTzOpen(false); setUserOpen(false); }}
                                className="text-gray-400 hover:text-white transition-colors p-1">
                                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Menu */}
                {mobileOpen && (
                    <div className="md:hidden py-4 border-t border-gray-800 flex flex-col gap-2">
                        <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
                            <LayoutDashboard className="w-5 h-5 text-gray-400" /> Dashboard
                        </Link>
                        <Link href="/flow-log" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
                            <List className="w-5 h-5 text-gray-400" /> Flow Log
                        </Link>
                        <Link href="/ip" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
                            <Globe className="w-5 h-5 text-gray-400" /> IP Search
                        </Link>
                        <Link href="/alerts" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all">
                            <Bell className="w-5 h-5 text-gray-400" /> Alerts
                        </Link>
                        {user?.role === 'admin' && (
                            <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-all">
                                <Settings className="w-5 h-5 text-amber-500/80" /> Admin
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
