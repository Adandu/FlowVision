'use client';

import ReactECharts from 'echarts-for-react';
import { DONUT_CENTER, DONUT_RADIUS, DONUT_HEIGHT, LEGEND_CONFIG } from './chartConstants';

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Use asterisks — block chars (████) don't render in ECharts default font
const mask = (i: number) => '*'.repeat(5 + (i % 3)); // *****  ******  *******  cycling

export default function TopPortsChart({ data, isGuest = false }: { data: { port: number | string; total_bytes: number }[]; isGuest?: boolean }) {
    const sortedData = [...data].sort((a, b) => b.total_bytes - a.total_bytes);

    const options = {
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const p = params.data;
                return `${params.marker} ${p.name}<br/>Traffic: <b>${isGuest ? '*****' : formatBytes(p.value)}</b>`;
            }
        },
        legend: LEGEND_CONFIG,
        series: [
            {
                name: 'Traffic',
                type: 'pie',
                radius: DONUT_RADIUS,
                center: DONUT_CENTER,
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 8, borderColor: '#111827', borderWidth: 2 },
                label: { show: false },
                labelLine: { show: false },
                data: sortedData.map((item, i) => ({
                    name: isGuest ? mask(i) : String(item.port),
                    value: item.total_bytes
                }))
            }
        ]
    };

    return <ReactECharts option={options} style={{ height: DONUT_HEIGHT, width: '100%' }} />;
}
