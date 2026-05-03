'use client';

import ReactECharts from 'echarts-for-react';
import { DONUT_CENTER, DONUT_RADIUS, DONUT_HEIGHT, LEGEND_CONFIG } from './chartConstants';
import { formatBytes } from '@/lib/formatters';

const COLORS: Record<string, string> = {
    TCP: '#3B82F6',
    UDP: '#10B981',
    ICMP: '#F59E0B',
    Other: '#6B7280',
};

const mask = (i: number) => '*'.repeat(5 + (i % 3));

export default function ProtocolChart({ data, isGuest = false }: { data: { proto: string; total_bytes: number }[]; isGuest?: boolean }) {
    const options = {
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                return `${params.marker}${params.name}<br/>Traffic: <b>${isGuest ? '*****' : formatBytes(params.value)}</b> (${params.percent}%)`;
            }
        },
        legend: LEGEND_CONFIG,
        series: [
            {
                name: 'Protocol',
                type: 'pie',
                radius: DONUT_RADIUS,
                center: DONUT_CENTER,
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 8, borderColor: '#111827', borderWidth: 2 },
                label: { show: false },
                labelLine: { show: false },
                data: data.map((item, i) => ({
                    value: item.total_bytes,
                    name: isGuest ? mask(i) : item.proto,
                    itemStyle: { color: COLORS[item.proto] || '#6B7280' },
                })),
            }
        ]
    };

    return <ReactECharts option={options} style={{ height: DONUT_HEIGHT, width: '100%' }} />;
}
