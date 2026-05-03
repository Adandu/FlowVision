'use client';

import Link from 'next/link';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    color?: 'blue' | 'emerald' | 'purple' | 'orange' | 'teal';
    span?: number;
    href?: string;
}

const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-500/0 border-blue-500/30 text-blue-400',
    emerald: 'from-emerald-500/20 to-emerald-500/0 border-emerald-500/30 text-emerald-400',
    purple: 'from-purple-500/20 to-purple-500/0 border-purple-500/30 text-purple-400',
    orange: 'from-orange-500/20 to-orange-500/0 border-orange-500/30 text-orange-400',
    teal: 'from-teal-500/20 to-teal-500/0 border-teal-500/30 text-teal-400',
};

export default function StatCard({ title, value, icon, color = 'blue', span = 1, href }: StatCardProps) {
    const innerClass = `bg-gradient-to-br ${colorMap[color]} bg-gray-900/80 border rounded-xl p-5 backdrop-blur-md relative overflow-hidden group hover:shadow-lg transition-all ${!href && span === 2 ? 'col-span-2' : ''} ${href ? 'cursor-pointer hover:border-gray-500/50' : ''} h-full`;

    const content = (
        <div className={innerClass}>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-current opacity-5 group-hover:opacity-10 transition-opacity blur-2xl" />
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">{title}</p>
                    <p className="text-2xl font-bold text-gray-100">{value}</p>
                </div>
                <div className="p-2.5 bg-gray-800/50 rounded-lg border border-gray-700/50">{icon}</div>
            </div>
        </div>
    );

    return href ? (
        <Link href={href} className={`block ${span === 2 ? 'col-span-2' : ''}`}>
            {content}
        </Link>
    ) : content;
}
