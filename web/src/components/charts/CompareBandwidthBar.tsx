'use client';

import ReactECharts from 'echarts-for-react';
import { formatBytes } from '@/lib/formatters';

interface PeriodSummary {
  total_bytes: string;
  outbound_bytes: string;
  inbound_bytes: string;
  internal_bytes: string;
}

interface Props {
  labelA: string;
  labelB: string;
  periodA: PeriodSummary;
  periodB: PeriodSummary;
}

export default function CompareBandwidthBar({ labelA, labelB, periodA, periodB }: Props) {
  const categories = ['Total', 'Outbound', 'Inbound', 'Internal'];
  const valA = [
    Number(periodA.total_bytes),
    Number(periodA.outbound_bytes),
    Number(periodA.inbound_bytes),
    Number(periodA.internal_bytes),
  ];
  const valB = [
    Number(periodB.total_bytes),
    Number(periodB.outbound_bytes),
    Number(periodB.inbound_bytes),
    Number(periodB.internal_bytes),
  ];

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#e5e7eb' },
      formatter: (params: any[]) =>
        `<b>${params[0].axisValue}</b><br/>${params.map((p: any) => `${p.marker}${p.seriesName}: ${formatBytes(p.value)}`).join('<br/>')}`,
    },
    legend: {
      data: [labelA, labelB],
      textStyle: { color: '#9ca3af' },
      top: 0,
    },
    grid: { top: 40, bottom: 30, left: 80, right: 20, containLabel: false },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: {
        color: '#9ca3af',
        fontSize: 10,
        formatter: (v: number) => formatBytes(v),
      },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    series: [
      {
        name: labelA,
        type: 'bar',
        data: valA,
        itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 40,
      },
      {
        name: labelB,
        type: 'bar',
        data: valB,
        itemStyle: { color: '#10b981', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 40,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 240 }} theme="dark" />;
}
