'use client';

import { useState, useEffect } from 'react';
import { List } from 'lucide-react';
import Navbar from '@/components/Navbar';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';

const FlowTable = dynamic(() => import('@/components/FlowTable'), { ssr: false });

export default function FlowLogPage() {
    const [flows, setFlows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState('50');
    const isLoggedIn = useAuth();

    useEffect(() => {
        setLoading(true);
        fetch(`/api/flows/recent?limit=${limit}`)
            .then(r => r.json())
            .then(j => { if (j.success) setFlows(j.data); })
            .finally(() => setLoading(false));
    }, [limit]);

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <List className="w-6 h-6 text-blue-400" />
                        <h1 className="text-2xl font-bold text-gray-100">Flow Log</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Display:</span>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                        >
                            <option value="50">50 Flows</option>
                            <option value="100">100 Flows</option>
                            <option value="250">250 Flows</option>
                            <option value="500">500 Flows</option>
                        </select>
                    </div>
                </div>

                {/* No overlay — data is redacted inline via isGuest prop */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
                    {loading && <p className="text-gray-500 text-sm animate-pulse text-center py-8">Loading flows…</p>}
                    {!loading && <FlowTable flows={flows} isGuest={isLoggedIn === false} />}
                </div>
            </main>
        </div>
    );
}
