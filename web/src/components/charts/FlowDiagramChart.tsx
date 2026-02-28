'use client';

import ReactECharts from 'echarts-for-react';

interface SankeyNode {
    name: string;
    itemStyle?: any;
}

interface SankeyLink {
    source: string;
    target: string;
    value: number;
}

interface Props {
    srcIp: string;
    data: { dst_ip: string; app: string; bytes: number }[];
}

function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FlowDiagramChart({ srcIp, data }: Props) {
    if (!data || data.length === 0) {
        return <div className="text-center text-gray-500 py-12">No flow data available for this source.</div>;
    }

    const nodesMap = new Map<string, SankeyNode>();
    const links: SankeyLink[] = [];

    // Root Source Node
    nodesMap.set(srcIp, { name: srcIp, itemStyle: { color: '#3B82F6' } });

    data.forEach(item => {
        // App Node (intermediate)
        const appName = item.app || 'Unknown';
        const appNodeId = `App: ${appName}`;
        if (!nodesMap.has(appNodeId)) {
            nodesMap.set(appNodeId, { name: appNodeId, itemStyle: { color: '#8B5CF6' } });
        }

        // Dest IP Node
        const dstNodeId = `Dst: ${item.dst_ip}`;
        if (!nodesMap.has(dstNodeId)) {
            nodesMap.set(dstNodeId, { name: dstNodeId, itemStyle: { color: '#10B981' } });
        }

        // Link: Source -> App
        const existingSrcToApp = links.find(l => l.source === srcIp && l.target === appNodeId);
        if (existingSrcToApp) {
            existingSrcToApp.value += item.bytes;
        } else {
            links.push({ source: srcIp, target: appNodeId, value: item.bytes });
        }

        // Link: App -> Dest
        const existingAppToDst = links.find(l => l.source === appNodeId && l.target === dstNodeId);
        if (existingAppToDst) {
            existingAppToDst.value += item.bytes;
        } else {
            links.push({ source: appNodeId, target: dstNodeId, value: item.bytes });
        }
    });

    const options = {
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: (params: any) => {
                if (params.dataType === 'node') {
                    return `${params.data.name.replace(/^(App|Dst): /, '')}`;
                }
                const source = params.data.source.replace(/^(App|Dst): /, '');
                const target = params.data.target.replace(/^(App|Dst): /, '');
                return `${source} → ${target}<br/><b>${formatBytes(params.data.value)}</b>`;
            }
        },
        series: {
            type: 'sankey',
            layout: 'none',
            emphasis: { focus: 'adjacency' },
            nodeAlign: 'left',
            data: Array.from(nodesMap.values()),
            links: links,
            lineStyle: {
                color: 'source',
                curveness: 0.5,
                opacity: 0.2
            },
            label: {
                color: '#D1D5DB',
                formatter: (p: any) => p.data.name.replace(/^(App|Dst): /, '')
            }
        }
    };

    return <ReactECharts option={options} style={{ height: '600px', width: '100%' }} theme="dark" />;
}
