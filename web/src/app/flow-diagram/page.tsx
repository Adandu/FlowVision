'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import dynamic from 'next/dynamic';
import { Activity, Network } from 'lucide-react';

const FlowDiagramChart = dynamic(() => import('@/components/charts/FlowDiagramChart'), { ssr: false });

export default function FlowDiagramPage() {
    const [sources, setSources] = useState<{ ip: string; bytes: number }[]>([]);
    const [selectedSrc, setSelectedSrc] = useState<string>('');
    const [diagramData, setDiagramData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDiagram, setLoadingDiagram] = useState(false);

    useEffect(() => {
        // Fetch top sources first to populate the dropdown
        fetch('/api/flows?interval=24h')
            .then(res => res.json())
            .then(json => {
                if (json.success && json.data.topSources) {
                    setSources(json.data.topSources);
                    if (json.data.topSources.length > 0) {
                        setSelectedSrc(json.data.topSources[0].ip);
                    }
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedSrc) return;
        setLoadingDiagram(true);
        fetch(`/api/flow-diagram?src_ip=${selectedSrc}`)
            .then(res => res.json())
            .then(json => {
                if (json.success) setDiagramData(json.data);
            })
            .catch(console.error)
            .finally(() => setLoadingDiagram(false));
    }, [selectedSrc]);

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                            <Network className="w-6 h-6 text-blue-400" />
                            Flow Diagram
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Visualize traffic traversing through your network.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-gray-400 text-sm font-medium">Source IP:</label>
                        <select
                            value={selectedSrc}
                            onChange={(e) => setSelectedSrc(e.target.value)}
                            disabled={loading}
                            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-mono"
                        >
                            {loading ? (
                                <option>Loading...</option>
                            ) : sources.length === 0 ? (
                                <option>No sources found (24h)</option>
                            ) : (
                                sources.map(s => (
                                    <option key={s.ip} value={s.ip}>{s.ip}</option>
                                ))
                            )}
                        </select>
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl min-h-[600px] relative">
                    {loadingDiagram && (
                        <div className="absolute inset-0 z-10 bg-gray-900/50 flex items-center justify-center rounded-xl backdrop-blur-sm">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full" />
                        </div>
                    )}

                    {!loading && sources.length > 0 && selectedSrc && (
                        <FlowDiagramChart srcIp={selectedSrc} data={diagramData} />
                    )}
                </div>
            </main>
        </div>
    );
}
