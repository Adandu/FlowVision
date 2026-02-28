'use client';

import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

interface Props {
    data: { time: string; total_bytes: number }[];
    timezone?: string;
    tzOffsetMinutes?: number;
    interval?: string;
}

function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function BandwidthChart({ data, timezone = 'UTC', tzOffsetMinutes = 0, interval }: Props) {
    // Shift timestamps by timezone offset so ECharts renders them in local time
    const shiftedData = data.map(item => {
        const utcMs = new Date(item.time).getTime();
        return [utcMs + tzOffsetMinutes * 60000, item.total_bytes];
    });

    let min: number | undefined;
    let max: number | undefined;

    if (interval) {
        const now = Date.now() + tzOffsetMinutes * 60000;
        max = now;
        switch (interval) {
            case 'Live': min = now - 60 * 1000; break;
            case '10m': min = now - 10 * 60 * 1000; break;
            case '1h': min = now - 60 * 60 * 1000; break;
            case '24h': min = now - 24 * 60 * 60 * 1000; break;
            case '1w': min = now - 7 * 24 * 60 * 60 * 1000; break;
            case '1mo': min = now - 30 * 24 * 60 * 60 * 1000; break;
        }
    }

    const options = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: (params: any) => {
                const [ts, val] = params[0].value;
                const localDate = new Date(ts - tzOffsetMinutes * 60000);
                const timeStr = new Intl.DateTimeFormat('en-GB', {
                    timeZone: timezone,
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    day: '2-digit', month: '2-digit',
                    hour12: false,
                }).format(localDate);
                return `${timeStr}<br/>Bandwidth: <b>${formatBytes(val)}</b>`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', start: 0, end: 100, bottom: 5, height: 25, textStyle: { color: '#9CA3AF' } }
        ],
        xAxis: {
            type: 'time',
            boundaryGap: false,
            min: min,
            max: max,
            axisLine: { lineStyle: { color: '#4B5563' } },
            axisLabel: {
                color: '#9CA3AF',
                formatter: (value: number) => {
                    const d = new Date(value - tzOffsetMinutes * 60000);
                    return new Intl.DateTimeFormat('en-GB', {
                        timeZone: timezone,
                        hour: '2-digit', minute: '2-digit',
                        hour12: false,
                    }).format(d);
                }
            }
        },
        yAxis: {
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
        series: [{
            name: 'Bandwidth',
            type: 'line',
            smooth: true,
            symbol: 'none',
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
                    { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
                ])
            },
            lineStyle: { color: '#3B82F6', width: 2 },
            data: shiftedData,
        }]
    };

    return <ReactECharts option={options} style={{ height: '350px', width: '100%' }} theme="dark" />;
}
