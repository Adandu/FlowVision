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
                    <Activity className="w-4 h-4 text-emerald-400" /> Top 10 Applications
                </h3>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500 text-sm">No specific services detected in this timeframe.</p>
                </div>
            </div>
        );
    }

    const options = {
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const item = params.data;
                return `${params.marker} ${item.name}<br/>Traffic: <b>${formatBytes(item.value)}</b>`;
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
                name: 'Applications',
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
                data: data.map(d => ({
                    name: d.service,
                    value: d.total_bytes,
                    itemStyle: { color: d.color }
                }))
            }
        ]
    };

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 shadow-xl w-full flex flex-col h-full">
            <h3 className="text-base font-semibold text-gray-200 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Top 10 Applications
            </h3>
            <div className="flex-1 w-full relative">
                <ReactECharts option={options} style={{ height: '300px', width: '100%' }} />
            </div>
        </div>
    );
}
