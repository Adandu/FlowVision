# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.3.1] - 2026-03-02

### Fixed
- **Top 10 Destinations / Sources missing headers**: Added `h2` card headers matching the style of all other dashboard widgets; these were lost when the ECharts built-in `title` was removed.
- **Admin Panel main page missing AI Integration card**: Added AI Integration and Notifications cards to the sections grid so all admin areas are accessible from the main Admin page. Also updated System version to `1.3.0`.
- **AI model lists outdated**: Updated with latest 2025/2026 models — Gemini 2.5 Pro/Flash Preview, Claude Opus 4.5, Claude Sonnet 4.5/4.0, Claude 3.7 Sonnet, OpenAI o3, o3 Mini, GPT-4.5 Preview.

---

## [1.3.0] - 2026-03-02

### Added
- **AI Model Selection**: Admin → AI Integration now has a model dropdown for each provider. Users can choose from:
  - **Gemini**: 2.0 Flash, 2.0 Flash Lite, 1.5 Pro, 1.5 Flash
  - **Claude**: 3.5 Haiku, 3.5 Sonnet, 3 Haiku, 3 Opus
  - **OpenAI**: GPT-4o Mini, GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo
  - Selected model persisted in ClickHouse settings and passed to the AI API on every call.

### Fixed
- **Donut charts overflow / inconsistent sizing**: Reduced chart height to 240px, donut radius to 40–65%, and center to 22%/50% so charts never exceed their card boundaries.
- **TopHostsChart hover overflow**: Removed the ECharts built-in `title` element and the `emphasis.label` center text that rendered large IP addresses inside the donut hole on hover. Replaced with a subtle shadow emphasis.
- **All 5 donut charts now pixel-identical**: Destinations, Sources, Services, Protocol, Applications share the same `chartConstants.ts` values.

---

## [1.2.0] - 2026-03-02

### Added
- **`/active-applications` page**: Dedicated page showing detected ASN/ISP application breakdown. Active Applications StatCard on the Dashboard now routes here instead of Active Services.

### Fixed
- **Gemini AI 404 error**: Updated model from deprecated `gemini-1.5-flash` to `gemini-2.0-flash`.
- **Donut chart layout inconsistency**: All five charts now share `chartConstants.ts` constants.
- **Active Applications StatCard**: Fixed href from `/active-services` to `/active-applications`.

---

## [1.1.0] - 2026-03-02

### Added
- AI Integration (Admin → AI Integration page), AI Summary Widget, `/api/ai/summary` route, Dashboard 5-widget grid.

### Fixed
- Donut legend overlap, IP Page Applications widget spanning 2 lines, Active Applications StatCard not clickable, IP Aliases description text, Flow Log aliases missing, Top 10 Applications double-card border.

---

## [1.0.0] - 2026-03-02

### Added
- Global GeoMap, Application Services Detection, Custom IP Aliases, Active Applications StatCard, Admin Logs Streaming, Flow Log Pagination.

### Changed
- Port/ASN widgets converted to Donut charts, dashboard widget grid reordered, IP detail page shows all records, FlowVision logo clickable, IP Aliases generic placeholders.

### Fixed
- Inbound Traffic 0B, Alias Click Navigation, Admin Logs truncated to 6 lines, Top 10 Applications widget missing.
