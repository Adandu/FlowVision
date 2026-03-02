'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Activity, ChevronLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import nextDynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';

const TopServicesCard = nextDynamic(() => import('@/components/charts/TopServicesCard'), { ssr: false });

export const dynamic = 'force-dynamic';

function ActiveApplicationsContent() {
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
                const res = await fetch(`/api/flows?interval=${queryInterval}`);
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
            timer = window.setInterval(fetchData, 5000);
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
                        <Activity className="w-6 h-6 text-orange-400" /> Active Applications
                        <span className="text-sm font-normal text-gray-400">({interval})</span>
                    </h1>
                    {loading && <div className="animate-pulse w-3 h-3 rounded-full bg-orange-500 ml-4" />}
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm shadow-xl min-h-[500px] flex flex-col">
                    {data?.topServices && data.topServices.length > 0 ? (
                        <TopServicesCard data={data.topServices} title="All Detected Applications" isGuest={isLoggedIn === false} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
                            <Activity className="w-10 h-10 opacity-40" />
                            <p className="text-sm">{loading ? 'Loading application data...' : 'No applications detected in this timeframe.'}</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function ActiveApplicationsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-orange-400">Loading Active Applications...</div>}>
            <ActiveApplicationsContent />
        </Suspense>
    );
}
