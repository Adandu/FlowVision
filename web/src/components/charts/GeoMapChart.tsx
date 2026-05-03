'use client';

import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { formatBytes } from '@/lib/formatters';

interface GeoData {
    ip: string;
    lat: number;
    lon: number;
    total_bytes: number;
    country: string;
    city?: string;
}

interface Props {
    title: string;
    data: GeoData[];
    onIpClick?: (ip: string) => void;
}

export default function GeoMapChart({ title, data, onIpClick }: Props) {
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        // Register the world map geojson only once
        if (echarts.getMap('world')) {
            setMapLoaded(true);
            return;
        }

        fetch('/world.json')
            .then(res => res.json())
            .then(worldJson => {
                echarts.registerMap('world', worldJson);
                setMapLoaded(true);
            })
            .catch(err => console.error("Failed to load world map:", err));
    }, []);

    if (!mapLoaded) {
        return <div className="h-[400px] w-full flex items-center justify-center text-gray-500 bg-gray-900/40 rounded-xl border border-gray-800/60 animate-pulse">Loading Map Data...</div>;
    }

    // Filter out rows missing coordinates and calculate min/max for scaling
    const validData = data.filter(d => d.lat !== 0 && d.lon !== 0 && !isNaN(d.lat) && !isNaN(d.lon));
    const maxBytes = Math.max(...validData.map(d => d.total_bytes), 1);

    const scatterData = validData.map(item => ({
        name: item.ip,
        value: [item.lon, item.lat, item.total_bytes],
        country: item.country,
        city: item.city || ''
    }));

    const options = {
        backgroundColor: 'transparent',
        title: {
            text: title,
            left: 'center',
            textStyle: { color: '#E5E7EB', fontSize: 16, fontWeight: 'normal' },
            top: 10
        },
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                const [lon, lat, bytes] = params.value;
                const loc = params.data.city ? `${params.data.city}, ${params.data.country}` : params.data.country;
                return `
                    <div style="font-family: monospace;">
                        <b style="color: #60A5FA;">${params.data.name}</b><br/>
                        ${loc}<br/>
                        Traffic: <b>${formatBytes(bytes)}</b>
                        ${onIpClick ? '<br/><span style="color:#9CA3AF;font-size:11px">Click to view details</span>' : ''}
                    </div>
                `;
            },
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: '#374151',
            textStyle: { color: '#e5e7eb' }
        },
        geo: {
            map: 'world',
            roam: true,
            zoom: 1.2,
            itemStyle: {
                areaColor: '#1F2937', // Dark gray land
                borderColor: '#374151',
                borderWidth: 0.5
            },
            emphasis: {
                itemStyle: {
                    areaColor: '#374151'
                },
                label: { show: false }
            }
        },
        series: [
            {
                name: 'Traffic',
                type: 'effectScatter',
                coordinateSystem: 'geo',
                data: scatterData,
                symbolSize: (val: number[]) => {
                    // Scale dot size from 5px to 25px based on bytes logarithmically to avoid giant dots
                    const bytes = val[2];
                    const ratio = Math.max(0, Math.log10(bytes) / Math.log10(maxBytes));
                    return 5 + (ratio * 20);
                },
                encode: {
                    value: 2
                },
                showEffectOn: 'render',
                rippleEffect: {
                    brushType: 'stroke',
                    scale: 3
                },
                itemStyle: {
                    color: '#3B82F6', // Tailwind blue-500
                    shadowBlur: 10,
                    shadowColor: '#60A5FA'
                },
                emphasis: {
                    scale: true
                }
            }
        ]
    };

    const onEvents = onIpClick ? {
        click: (params: any) => {
            if (params.data && params.data.name) onIpClick(params.data.name);
        }
    } : undefined;

    return (
        <div className="w-full bg-gray-900/40 rounded-xl border border-gray-800/60 overflow-hidden relative">
            <ReactECharts
                option={options}
                style={{ height: '400px', width: '100%' }}
                onEvents={onEvents}
                theme="dark"
            />
        </div>
    );
}
