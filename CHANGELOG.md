# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-02

### Added
- **Global GeoMap Tracking**: Implemented ECharts integration to visualize inbound/outbound traffic directly on a 3D Earth projection.
- **Application 'Services' Detection Layer**: Intelligent ASN/ISP mapping allowing raw Netflow outputs to be classified into specific software platforms (e.g., Netflix, Google Cloud, Meta/WhatsApp).
- **Custom Administrator Aliases**: IP addresses can now be aliased directly to human-readable server names that persist globally across all views (e.g., `192.168.1.1` -> `MyRouter`).
- **Dashboard StatCards**: Introduced new aggregated Active IPs, Active Services, and Active Applications metric headers.
- **Top 10 Metrics Control**: Real-time traffic is now properly sliced to show accurate and performant Top 10 widgets across Destinations, Sources, ports, and applications.
- **Admin Logs Streaming Viewer**: Dedicated NetFlows internal log tab using explicit terminal pipelines to monitor live router handshakes.
- **Pagination Dropdowns**: Variable dataset loading mechanisms added within FlowLogs page, supporting between 50 and 1,000 deep traces.

### Changed
- Render metrics (Ports & ASN) converted into beautifully aligned space-saving vertical Donut Pie charts.
- Overhauled the core MySQL aggregation queries by redefining the bounds between internal traffic vs. absolute ingress traffic.
- Navigation Logo UI dynamically routed to trigger SPA state resets.

### Fixed
- Stabilized `supervisord` internal buffer errors reading short streams by porting to native file `tail -n`.
- Solved Dashboard `0B Inbound Traffic` anomaly resulting from inverse masking boundaries.
- Addressed IP Page visualization errors which sporadically dropped data by implementing Fallback arrays for unknown Application traffic.
