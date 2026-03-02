'use client';

import ReactECharts from 'echarts-for-react';
import { Activity } from 'lucide-react';
import { DONUT_CENTER, DONUT_RADIUS, DONUT_HEIGHT, LEGEND_CONFIG } from './chartConstants';

interface Props {
    data: { service: string; total_bytes: number; color: string }[];
    title?: string;
    isGuest?: boolean;
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const REDACTED = '████';

export default function TopServicesCard({ data, title = 'Top 10 Applications', isGuest = false }: Props) {
    if (!data || data.length === 0) {
        return (
            <>
                <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> {title}
                </h3>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500 text-sm">No specific services detected in this timeframe.</p>
                </div>
            </>
        );
    }

    const options = {
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const item = params.data;
                return `${params.marker} ${item.name}<br/>Traffic: <b>${isGuest ? REDACTED : formatBytes(item.value)}</b>`;
            }
        },
        legend: LEGEND_CONFIG,
        series: [
            {
                name: 'Applications',
                type: 'pie',
                radius: DONUT_RADIUS,
                center: DONUT_CENTER,
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#111827',
                    borderWidth: 2
                },
                label: { show: false },
                labelLine: { show: false },
                data: data.map((d, i) => ({
                    name: isGuest ? `${REDACTED}${i > 0 ? ' '.repeat(i) : ''}` : d.service,
                    value: d.total_bytes,
                    itemStyle: { color: d.color }
                }))
            }
        ]
    };

    return (
        <>
            <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> {title}
            </h3>
            <div className="flex-1 w-full relative min-h-0">
                <ReactECharts option={options} style={{ height: DONUT_HEIGHT, width: '100%' }} />
            </div>
        </>
    );
}
