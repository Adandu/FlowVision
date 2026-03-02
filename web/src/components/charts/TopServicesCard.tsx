'use client';

import ReactECharts from 'echarts-for-react';
import { Activity } from 'lucide-react';

interface Props {
    data: { service: string; total_bytes: number; color: string }[];
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function TopServicesCard({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl w-full h-96 flex flex-col">
                <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Detected Services
                </h3>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500 text-sm">No specific services detected in this timeframe.</p>
                </div>
            </div>
        );
    }

    const options = {
        grid: { top: 10, right: 30, bottom: 20, left: 15, containLabel: true },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const item = params[0];
                return `${item.marker} ${item.name}<br/>Traffic: <b>${formatBytes(item.value)}</b>`;
            }
        },
        xAxis: {
            type: 'value',
            axisLabel: {
                color: '#9CA3AF',
                formatter: (val: number) => {
                    if (val >= 1073741824) return (val / 1073741824).toFixed(1) + ' GB';
                    if (val >= 1048576) return (val / 1048576).toFixed(1) + ' MB';
                    if (val >= 1024) return (val / 1024).toFixed(1) + ' KB';
                    return val + ' B';
                }
            },
            splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }
        },
        yAxis: {
            type: 'category',
            data: data.map(d => d.service),
            axisLabel: { color: '#D1D5DB', width: 120, overflow: 'truncate' },
            inverse: true, // Largest at the top
            axisTick: { show: false },
            axisLine: { show: false }
        },
        series: [
            {
                name: 'Traffic',
                type: 'bar',
                data: data.map(d => ({
                    value: d.total_bytes,
                    itemStyle: { color: d.color, borderRadius: [0, 4, 4, 0] }
                })),
                barWidth: '50%',
                label: {
                    show: true,
                    position: 'right',
                    color: '#9CA3AF',
                    formatter: (p: any) => formatBytes(p.value)
                }
            }
        ]
    };

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl w-full flex flex-col" style={{ minHeight: '350px' }}>
            <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Detected Services
            </h3>
            <div className="flex-1 w-full relative">
                <ReactECharts option={options} style={{ height: '300px', width: '100%' }} />
            </div>
        </div>
    );
}
