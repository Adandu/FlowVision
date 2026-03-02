'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
    interval: string;
    context: 'dashboard' | 'ip';
    ip?: string;
}

export default function AISummaryWidget({ interval, context, ip }: Props) {
    const [summary, setSummary] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [provider, setProvider] = useState<string>('');
    const [visible, setVisible] = useState(true);
    const [collapsed, setCollapsed] = useState(false);

    const fetchSummary = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ interval, context });
            if (ip) params.set('ip', ip);
            const res = await fetch(`/api/ai/summary?${params.toString()}`);
            const data = await res.json();
            if (data.summary) {
                setSummary(data.summary);
                setProvider(data.provider || '');
                setVisible(true);
            } else if (data.error && (data.error.includes('not enabled') || data.error.includes('No API key'))) {
                // AI not configured — silently hide
                setVisible(false);
            } else {
                setError(data.error || 'Failed to get AI summary');
            }
        } catch {
            setVisible(false);
        } finally {
            setLoading(false);
        }
    }, [interval, context, ip]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    if (!visible && !loading) return null;

    const providerLabel: Record<string, string> = {
        gemini: 'Gemini',
        claude: 'Claude',
        openai: 'ChatGPT',
    };

    return (
        <div className="relative rounded-xl overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.06) 50%, rgba(16,185,129,0.05) 100%)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'rgba(139,92,246,0.3)',
        }}>
            {/* Animated top border shimmer */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-60" />

            <div className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Sparkles className="w-4 h-4 text-violet-400" />
                            {loading && (
                                <div className="absolute inset-0 animate-ping">
                                    <Sparkles className="w-4 h-4 text-violet-400 opacity-50" />
                                </div>
                            )}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-200">
                            AI Traffic Summary
                            {provider && !loading && (
                                <span className="ml-2 text-[10px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20">
                                    via {providerLabel[provider] || provider}
                                </span>
                            )}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={fetchSummary}
                            disabled={loading}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                            title="Refresh summary"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-400' : ''}`} />
                        </button>
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                            title={collapsed ? "Expand" : "Collapse"}
                        >
                            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {!collapsed && (
                    <div className="mt-3">
                        {loading && (
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-sm text-gray-500">Analyzing network traffic...</span>
                            </div>
                        )}
                        {error && !loading && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        {summary && !loading && (
                            <p className="text-sm text-gray-300 leading-relaxed">
                                {summary}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
