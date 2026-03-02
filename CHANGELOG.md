# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.0] - 2026-03-02

### Fixed
- **Donut legend overlap**: Pinned pie chart center to 24% of canvas width and legend start to 52% — the two elements no longer collide at any browser width.
- **IP Page → All Applications widget spanning 2 lines**: Wrapped the `TopServicesCard` in a proper `bg-gray-900 border rounded-xl` card container inside the donut grid, matching the other widgets.
- **Active Applications StatCard not clickable**: Added `href=/active-services?interval=...` so it navigates like the other metric header cards.
- **IP Aliases description text**: Replaced example alias "MasterChief" with "MyServer" to match the updated placeholder standard.
- **Flow Log aliases missing after refactor**: Extended the `Flow` interface with optional `src_displayName` / `dst_displayName` fields; FlowTable now renders the alias label while keeping the real IP in the navigation link.
- **Top 10 Applications widget double-card border**: Removed the internal card wrapper from `TopServicesCard` so the parent container in `page.tsx` provides the single consistent border.

### Added
- **AI Integration** (Admin → AI Integration page): Toggle AI on/off, select provider (Google Gemini, Anthropic Claude, OpenAI ChatGPT), enter API key, and test connection. Settings persist in ClickHouse.
- **AI Summary Widget** (`AISummaryWidget`): Glassmorphism-styled card shown at the top of the Dashboard and each IP detail page when AI is enabled and configured. Features animated loading dots, a collapse/expand toggle, and a refresh button. Silently hidden when AI is unconfigured.
- **`/api/ai/summary` route**: Reads AI settings from ClickHouse, fetches live traffic snapshot, constructs a prompt, and calls the configured AI provider. Returns a 2-3 sentence network insight.
- **Dashboard 5-widget grid**: Top 10 Destinations, Sources, Services, Protocol Breakdown, and Applications now in a single consistent `lg:grid-cols-5` row.

### Changed
- `applyAliases()` now stores alias as `displayName` field instead of overwriting the real `ip`/`src_ip`/`dst_ip` — preserving correct navigation while still showing human-friendly labels in charts and tables.
- Top Applications widget is always rendered in the grid (no longer hidden by a `length > 0` guard).

---

## [1.0.0] - 2026-03-02

### Added
- **Global GeoMap Tracking**: ECharts 3D Earth projection visualizing inbound/outbound traffic by geography.
- **Application Services Detection**: ASN/ISP mapping classifying Netflow into known platforms (Netflix, Google Cloud, Meta/WhatsApp, Cloudflare, etc.) with an "Other" fallback bucket.
- **Custom IP Aliases**: Human-readable server names persisted globally. Labels shown in charts; real IPs preserved for navigation.
- **Active Applications StatCard**: New metric header counting unique detected application providers.
- **Admin Logs Streaming Viewer**: NetFlows and WebUI log tabs using native `tail -n` for reliable line-based reading.
- **Flow Log Pagination**: Dropdown selector (50 / 100 / 250 / 500 / 1000 flows).

### Changed
- Port-based and ASN-based widgets converted to vertical-legend Donut Pie charts.
- Dashboard widget grid reordered: Destinations → Sources → Services → Protocol → Applications.
- IP detail page widgets show all historical records (not capped at 10) for the selected interval.
- FlowVision navbar logo is now a clickable link back to the Dashboard.
- IP Aliases form uses generic placeholders with IPv4/IPv6 format validation.

### Fixed
- **Inbound Traffic 0B**: Corrected SQL direction query so `inbound_bytes` sums flows where `src_ip` is public and `dst_ip` is private.
- **Alias Click Navigation**: Clicking an aliased IP now routes to the correct real IP page.
- **Admin Logs truncated to 6 lines**: Replaced `supervisorctl tail` with `tail -n 1000` on physical log files.
- **Top 10 Applications widget missing from Dashboard**: Removed conditional `length > 0` guard.
