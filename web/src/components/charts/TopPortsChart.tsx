'use client';

import ReactECharts from 'echarts-for-react';
import { DONUT_CENTER, DONUT_RADIUS, DONUT_HEIGHT, LEGEND_CONFIG } from './chartConstants';
import { formatBytes } from '@/lib/formatters';

export default function TopPortsChart({ data }: { data: { port: number | string; total_bytes: number }[] }) {
    const sortedData = [...data].sort((a, b) => b.total_bytes - a.total_bytes);

    const options = {
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const p = params.data;
                return `${params.marker} ${p.name}<br/>Traffic: <b>${formatBytes(p.value)}</b>`;
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
                data: sortedData.map((item) => ({
                    name: String(item.port),
                    value: item.total_bytes
                }))
            }
        ]
    };

    return <ReactECharts option={options} style={{ height: DONUT_HEIGHT, width: '100%' }} />;
}
