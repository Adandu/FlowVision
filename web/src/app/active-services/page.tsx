'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Server, ChevronLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import nextDynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';

const TopPortsChart = nextDynamic(() => import('@/components/charts/TopPortsChart'), { ssr: false });

export const dynamic = 'force-dynamic';

function ActiveServicesContent() {
    const searchParams = useSearchParams();
    const interval = searchParams.get('interval') || 'Live';
    const queryInterval = interval === 'Live' ? '5m' : interval;
    const isLoggedIn = useAuth();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        let timer: number;

        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/flows?interval=${queryInterval}&limit=50`);
                const json = await res.json();
                if (isMounted && json.success) setData(json.data);
            } catch (err) {
                console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchData();
        if (interval === 'Live') {
            timer = window.setInterval(fetchData, 3000);
        } else {
            timer = window.setInterval(fetchData, 60000);
        }

        return () => { isMounted = false; clearInterval(timer); };
    }, [interval, queryInterval]);

    return (
        <div className="min-h-screen bg-gray-950 pb-12">
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Server className="w-6 h-6 text-purple-400" /> Active Services (Top 50) <span className="text-sm font-normal text-gray-400">({interval})</span>
                    </h1>
                    {loading && <div className="animate-pulse w-3 h-3 rounded-full bg-blue-500 ml-4" />}
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl min-h-[500px]">
                    {data?.topPorts && <TopPortsChart data={data.topPorts} isGuest={isLoggedIn === false} />}
                </div>
            </main>
        </div>
    );
}

export default function ActiveServicesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-emerald-400">Loading Active Services...</div>}>
            <ActiveServicesContent />
        </Suspense>
    );
}
