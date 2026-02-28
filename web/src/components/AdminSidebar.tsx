import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Users, ArrowLeft, Database, Activity, MonitorCog, Bell, Globe } from 'lucide-react';

export default function AdminSidebar() {
    const pathname = usePathname();

    const links = [
        { href: '/admin/users', icon: <Users className="w-4 h-4" />, label: 'Users & Auth', activeClass: 'text-emerald-400 bg-emerald-500/10', color: 'text-emerald-400' },
        { href: '/admin/aliases', icon: <MonitorCog className="w-4 h-4" />, label: 'IP Aliases', activeClass: 'text-blue-400 bg-blue-500/10', color: 'text-blue-400' },
        { href: '/admin/metrics', icon: <Activity className="w-4 h-4" />, label: 'Metrics', activeClass: 'text-pink-400 bg-pink-500/10', color: 'text-pink-400' },
        { href: '/admin/tasks', icon: <Database className="w-4 h-4" />, label: 'Scheduled Tasks', activeClass: 'text-amber-400 bg-amber-500/10', color: 'text-amber-400' },
        { href: '/admin/retention', icon: <Settings className="w-4 h-4" />, label: 'Data Retention', activeClass: 'text-gray-200 bg-gray-800', color: 'text-gray-400' },
        { href: '/admin/notifications', icon: <Bell className="w-4 h-4" />, label: 'Notifications', activeClass: 'text-purple-400 bg-purple-500/10', color: 'text-purple-400' },
        { href: '/admin/oidc', icon: <Globe className="w-4 h-4" />, label: 'OIDC / SSO', activeClass: 'text-indigo-400 bg-indigo-500/10', color: 'text-indigo-400' },
    ];

    return (
        <div className="w-full md:w-64 flex-shrink-0">
            <Link href="/admin" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-6 transition-colors w-fit">
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-gray-800 bg-gray-800/50">
                    <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Admin Panel</h2>
                </div>
                <nav className="p-2 space-y-1">
                    {links.map(link => {
                        const active = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? link.activeClass : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
                            >
                                <span className={active ? link.color : 'text-gray-400'}>{link.icon}</span>
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div >
    );
}
