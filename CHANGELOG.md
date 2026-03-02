# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-03-02

### Added
- **Global GeoMap Tracking**: ECharts 3D Earth projection visualizing inbound/outbound traffic by geography.
- **AI Traffic Summaries**: Configurable AI integration (Google Gemini, Anthropic Claude, OpenAI ChatGPT) generates a concise 2-3 sentence network insight widget shown at the top of the Dashboard and each IP detail page. Toggle, provider selection, and API keys managed via Admin → AI Integration.
- **Application Services Detection**: Intelligent ASN/ISP mapping classifying raw Netflow data into known platforms (Netflix, Google Cloud, Meta/WhatsApp, Cloudflare, etc.) with an "Other" bucket for unclassified traffic.
- **Custom IP Aliases**: Human-readable server names for IP addresses, persisted globally. Alias labels shown in charts while real IPs are preserved for correct navigation.
- **Dashboard 5-Widget Grid**: Top 10 Destinations, Top 10 Sources, Top 10 Services, Protocol Breakdown, and Top 10 Applications — always visible in a single consistent grid row.
- **Active Applications StatCard**: New header metric counting unique detected application providers.
- **Admin Logs Streaming Viewer**: Dedicated NetFlows tab reading raw Telegraf output, WebUI tab for NextJS logs, using native `tail -n` for reliable line-based reading.
- **Flow Log Pagination**: Dropdown selector (50 / 100 / 250 / 500 / 1000 flows) on the Flow Log page.
- **Admin AI Integration Page**: Toggle AI on/off, select active provider, input API keys, and test connections — all persisted via ClickHouse settings table.

### Changed
- Port-based "Top Services" and ASN-based "Top Applications" widgets converted to vertical-legend Donut Pie charts.
- Dashboard widget grid reordered: Destinations → Sources → Services → Protocol → Applications.
- IP detail page widgets show all historical records (not capped at 10) for the selected interval.
- FlowVision logo in Navbar is now a clickable link back to the Dashboard.
- IP Aliases form uses generic placeholders (`192.168.1.1` / `MyServer`) with IPv4/IPv6 format validation.

### Fixed
- **Inbound Traffic 0B**: Corrected the SQL direction query — `inbound_bytes` now correctly sums flows where `src_ip` is public AND `dst_ip` is private.
- **Alias Click Navigation**: Clicking an aliased IP in a chart now routes to the correct real IP page instead of a broken alias-name URL.
- **Admin Logs truncated to 6 lines**: Replaced `supervisorctl tail` (byte-based) with `tail -n 1000` (line-based) against physical supervisor log files.
- **Top 10 Applications widget missing**: Removed the conditional `length > 0` guard so the widget is always present in the layout.
