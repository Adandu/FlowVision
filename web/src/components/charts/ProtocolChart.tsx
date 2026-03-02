'use client';

import ReactECharts from 'echarts-for-react';
import { DONUT_CENTER, DONUT_RADIUS, DONUT_HEIGHT, LEGEND_CONFIG } from './chartConstants';

const COLORS: Record<string, string> = {
    TCP: '#3B82F6',
    UDP: '#10B981',
    ICMP: '#F59E0B',
    Other: '#6B7280',
};

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function ProtocolChart({ data }: { data: { proto: string; total_bytes: number }[] }) {
    const options = {
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                return `${params.marker}${params.name}<br/>Bandwidth: <b>${formatBytes(params.value)}</b> (${params.percent}%)`;
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
                emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#F3F4F6' } },
                labelLine: { show: false },
                data: data.map(item => ({
                    value: item.total_bytes,
                    name: item.proto,
                    itemStyle: { color: COLORS[item.proto] || '#6B7280' },
                })),
            }
        ]
    };

    return <ReactECharts option={options} style={{ height: DONUT_HEIGHT, width: '100%' }} />;
}
