'use client';

import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

export default function TopPortsChart({ data }: { data: { port: number | string; total_bytes: number }[] }) {
    // Sort descending
    const sortedData = [...data].sort((a, b) => a.total_bytes - b.total_bytes);

    const options = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const p = params[0];
                const bytes = p.value;
                let readable: string;
                if (bytes === 0) { readable = '0 B'; }
                else {
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    readable = parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                }
                return `${p.marker}${p.axisValue}<br/>Bandwidth: <b>${readable}</b>`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#4B5563' } },
            axisLabel: {
                color: '#9CA3AF',
                formatter: (value: number) => {
                    if (value === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(value) / Math.log(k));
                    return parseFloat((value / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                }
            },
            splitLine: { lineStyle: { color: '#374151' } }
        },
        yAxis: {
            type: 'category',
            data: sortedData.map(item => String(item.port)),
            axisLine: { lineStyle: { color: '#4B5563' } },
            axisLabel: { color: '#D1D5DB' }
        },
        series: [
            {
                name: 'Bandwidth',
                type: 'bar',
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                        { offset: 0, color: '#10B981' },
                        { offset: 1, color: '#047857' }
                    ]),
                    borderRadius: [0, 4, 4, 0]
                },
                data: sortedData.map(item => item.total_bytes)
            }
        ]
    };

    return <ReactECharts option={options} style={{ height: '300px', width: '100%' }} />;
}
