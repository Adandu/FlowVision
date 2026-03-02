'use client';

import ReactECharts from 'echarts-for-react';
import { DONUT_CENTER, DONUT_RADIUS, DONUT_HEIGHT, LEGEND_CONFIG } from './chartConstants';

interface Props {
    data: { ip: string; total_bytes: number; displayName?: string }[];
    title: string;
    onIpClick?: (ip: string) => void;
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function TopHostsChart({ data, title, onIpClick }: Props) {
    const options = {
        // No ECharts title — the card header handles the title
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const bytes = params.value;
                let readable: string;
                if (bytes === 0) { readable = '0 B'; }
                else {
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    readable = parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                }
                return `${params.marker}${params.name}<br/>Bandwidth: <b>${readable}</b> (${params.percent}%)${onIpClick ? '<br/><span style="color:#60A5FA;font-size:11px">Click to view details</span>' : ''}`;
            }
        },
        legend: { ...LEGEND_CONFIG },
        series: [
            {
                name: 'Bytes',
                type: 'pie',
                radius: DONUT_RADIUS,
                center: DONUT_CENTER,
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#111827',
                    borderWidth: 2,
                    cursor: onIpClick ? 'pointer' : 'default',
                },
                // No center/emphasis label — prevents text overflow on hover
                label: { show: false },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' }
                },
                labelLine: { show: false },
                data: data.map(item => ({
                    value: item.total_bytes,
                    name: item.displayName || item.ip,
                    realIp: item.ip
                }))
            }
        ]
    };

    const onEvents = onIpClick ? {
        click: (params: any) => {
            const ip = params.data?.realIp || params.name;
            if (ip) onIpClick(ip);
        }
    } : undefined;

    return <ReactECharts option={options} style={{ height: DONUT_HEIGHT, width: '100%' }} onEvents={onEvents} />;
}
