'use client';

import ReactECharts from 'echarts-for-react';

interface Props {
    data: { ip: string; total_bytes: number }[];
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
        title: {
            text: title,
            left: 'center',
            textStyle: { color: '#E5E7EB', fontSize: 16, fontWeight: 'normal' }
        },
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
        legend: {
            orient: 'horizontal',
            bottom: '0%',
            left: 'center',
            textStyle: { color: '#9CA3AF' },
            type: 'scroll',
        },
        series: [
            {
                name: 'Bytes',
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#111827',
                    borderWidth: 2,
                    cursor: onIpClick ? 'pointer' : 'default',
                },
                label: { show: false, position: 'center' },
                emphasis: {
                    label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#F3F4F6' }
                },
                labelLine: { show: false },
                data: data.map(item => ({ value: item.total_bytes, name: item.ip }))
            }
        ]
    };

    const onEvents = onIpClick ? {
        click: (params: any) => {
            if (params.name) onIpClick(params.name);
        }
    } : undefined;

    return <ReactECharts option={options} style={{ height: '300px', width: '100%' }} onEvents={onEvents} />;
}
