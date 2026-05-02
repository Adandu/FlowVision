'use client';

import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

interface Props {
    data: { time: string; total_bytes: number; bits_per_second?: number }[];
    timezone?: string;
    tzOffsetMinutes?: number;
    interval?: string;
}

function formatBits(bitsPerSecond: number) {
    if (!bitsPerSecond || bitsPerSecond <= 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    const i = Math.max(0, Math.floor(Math.log(bitsPerSecond) / Math.log(k)));
    const validIndex = Math.min(i, sizes.length - 1);
    return parseFloat((bitsPerSecond / Math.pow(k, validIndex)).toFixed(2)) + ' ' + sizes[validIndex];
}

export default function BandwidthChart({ data, timezone = 'UTC', tzOffsetMinutes = 0, interval }: Props) {
    // Convert ClickHouse UTC strings to true Epoch milliseconds
    const shiftedData = data.map(item => {
        // Ensure string is parsed as UTC by appending 'Z'
        const timeStr = item.time.includes('Z') ? item.time : item.time + 'Z';
        const utcMs = new Date(timeStr).getTime();
        return [utcMs, item.bits_per_second ?? 0];
    });

    let min: number | undefined;
    let max: number | undefined;

    if (interval) {
        const now = Date.now();
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
                const localDate = new Date(ts);
                const timeStr = new Intl.DateTimeFormat('en-GB', {
                    timeZone: timezone,
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    day: '2-digit', month: '2-digit',
                    hour12: false,
                }).format(localDate);
                return `${timeStr}<br/>Bandwidth: <b>${formatBits(val)}</b>`;
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
                    const d = new Date(value);
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
            minInterval: 1, // Prevent fractional byte splits (like 0.5 B)
            axisLine: { lineStyle: { color: '#4B5563' } },
            axisLabel: {
                color: '#9CA3AF',
                formatter: (value: number) => {
                    if (value <= 0) return '0 bps';
                    const k = 1000;
                    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
                    const i = Math.max(0, Math.floor(Math.log(value) / Math.log(k)));
                    const validIndex = Math.min(i, sizes.length - 1);
                    return parseFloat((value / Math.pow(k, validIndex)).toFixed(1)) + ' ' + sizes[validIndex];
                }
            },
            splitLine: { lineStyle: { color: '#374151' } }
        },
        series: [{
            name: 'Bandwidth',
            type: 'line',
            smooth: true,
            symbol: 'none',
            connectNulls: true, // Connect lines across gaps
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
                    { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
                ]),
                origin: 'start'
            },
            lineStyle: { color: '#3B82F6', width: 2 },
            data: shiftedData, // Array of [timestamp, value] pairs
        }]
    };

    return <ReactECharts option={options} style={{ height: '350px', width: '100%' }} theme="dark" />;
}
