'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

/**
 * Semi-transparent frosted-glass overlay shown on sensitive widgets for
 * unauthenticated (guest) users.
 *
 * The parent container MUST have `position: relative` and `overflow: hidden`.
 */
export default function GuestOverlay() {
    return (
        <div
            className="absolute inset-0 z-10 rounded-xl flex flex-col items-center justify-center gap-3"
            style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                background: 'rgba(9,11,20,0.55)',
            }}
        >
            <div className="p-3 bg-gray-800/80 rounded-full border border-gray-700/60">
                <Lock className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-300">Sign in to view details</p>
            <Link
                href="/login"
                className="mt-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            >
                Login
            </Link>
        </div>
    );
}
