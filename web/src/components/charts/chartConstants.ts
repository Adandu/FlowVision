'use client';

import ReactECharts from 'echarts-for-react';

// Shared donut chart constants for consistency across all 5 dashboard widgets
export const DONUT_CENTER: [string, string] = ['24%', '50%'];
export const DONUT_RADIUS: [string, string] = ['45%', '72%'];
export const DONUT_HEIGHT = '280px';
export const LEGEND_CONFIG = {
    orient: 'vertical' as const,
    left: '52%',
    top: 'middle' as const,
    textStyle: { color: '#9CA3AF', fontSize: 11 },
    type: 'scroll' as const,
    pageTextStyle: { color: '#6B7280' },
    pageIconColor: '#9CA3AF',
};
