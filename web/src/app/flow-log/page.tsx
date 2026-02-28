'use client';

import { useState, useEffect } from 'react';
import { List } from 'lucide-react';
import Navbar from '@/components/Navbar';
import dynamic from 'next/dynamic';

const FlowTable = dynamic(() => import('@/components/FlowTable'), { ssr: false });

export default function FlowLogPage() {
    const [flows, setFlows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/flows/recent?limit=500')
            .then(r => r.json())
            .then(j => { if (j.success) setFlows(j.data); })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 mt-8">
                <div className="flex items-center gap-2 mb-6">
                    <List className="w-6 h-6 text-blue-400" />
                    <h1 className="text-2xl font-bold text-gray-100">Flow Log</h1>
                    <span className="text-sm text-gray-500">(last 500 flows)</span>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
                    {loading && <p className="text-gray-500 text-sm animate-pulse text-center py-8">Loading flows…</p>}
                    {!loading && flows.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No flows recorded yet</p>}
                    {!loading && flows.length > 0 && <FlowTable flows={flows} />}
                </div>
            </main>
        </div>
    );
}
