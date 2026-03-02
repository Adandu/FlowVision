// Shared donut chart constants for consistency across all 5 dashboard widgets
// All charts must use these values — do not override per-component

export const DONUT_CENTER: [string, string] = ['22%', '50%'];
export const DONUT_RADIUS: [string, string] = ['40%', '65%'];
export const DONUT_HEIGHT = '240px';
export const LEGEND_CONFIG = {
    orient: 'vertical' as const,
    left: '48%',
    top: 'middle' as const,
    textStyle: { color: '#9CA3AF', fontSize: 11 },
    type: 'scroll' as const,
    pageTextStyle: { color: '#6B7280' },
    pageIconColor: '#9CA3AF',
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
};
