'use client';

import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

export default function TopPortsChart({ data }: { data: { port: number | string; total_bytes: number }[] }) {
    // Sort descending
    const sortedData = [...data].sort((a, b) => a.total_bytes - b.total_bytes);

    const options = {
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const p = params.data;
                const bytes = p.value;
                let readable: string;
                if (bytes === 0) { readable = '0 B'; }
                else {
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    readable = parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                }
                return `${params.marker} ${p.name}<br/>Traffic: <b>${readable}</b>`;
            }
        },
        legend: {
            orient: 'vertical',
            right: '0%',
            top: 'middle',
            textStyle: { color: '#9CA3AF' },
            type: 'scroll',
        },
        series: [
            {
                name: 'Traffic',
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['30%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#111827',
                    borderWidth: 2
                },
                label: { show: false },
                labelLine: { show: false },
                data: sortedData.map(item => ({
                    name: String(item.port),
                    value: item.total_bytes
                }))
            }
        ]
    };

    return <ReactECharts option={options} style={{ height: '300px', width: '100%' }} />;
}
