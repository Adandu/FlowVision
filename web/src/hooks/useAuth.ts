'use client';

import { useState, useEffect } from 'react';

/**
 * Returns the current auth state.
 * - null  → still loading (unknown)
 * - true  → logged in
 * - false → guest / not authenticated
 */
export function useAuth(): boolean | null {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(j => setIsLoggedIn(!!(j.success && j.user)))
            .catch(() => setIsLoggedIn(false));
    }, []);

    return isLoggedIn;
}
