'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Server } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function IPSearchPage() {
    const [ip, setIp] = useState('');
    const router = useRouter();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = ip.trim();
        if (trimmed) {
            router.push(`/ip/${encodeURIComponent(trimmed)}`);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-gray-950 flex flex-col">
            <Navbar />
            <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-xl">
                    <div className="text-center mb-8">
                        <div className="bg-blue-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                            <Server className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">Search IP Address</h1>
                        <p className="text-gray-400">Enter an IP to view flow diagrams, donut charts, and connection logs.</p>
                    </div>

                    <form onSubmit={handleSearch} className="relative">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                value={ip}
                                onChange={(e) => setIp(e.target.value)}
                                placeholder="e.g. 192.168.1.1 or 8.8.8.8"
                                className="w-full pl-12 pr-4 py-4 bg-gray-900 border border-gray-800 rounded-xl text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xl"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!ip.trim()}
                            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                        >
                            Analyze Traffic
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
