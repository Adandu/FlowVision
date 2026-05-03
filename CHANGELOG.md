# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.0.0] - 2026-05-04

### Added
- **Global Filter Bar** — all pages now share a unified filter bar with time range presets (Live / 10m / 1h / 24h / 1w / 1mo / Custom) plus src IP/CIDR, dst IP/CIDR, port, and protocol filters persisted in the URL query string.
- **SQL-safe filter utilities** (`lib/queryFilters.ts`) — `buildTimeFilter`, `buildIpFilter` (supports exact IP and CIDR), `buildProtocolFilter`, `buildPortFilter`, `combineFilters` with strict regex validation to prevent SQL injection.
- **Flow Log upgrades** — added direction filter (All / Outbound / Inbound / Internal), minimum flow size filter, display limit control, and CSV export.
- **IP Detail page — protocol breakdown table** — shows exact bytes and flow count per protocol (TCP/UDP/ICMP/Other) with click-through to filtered Flow Log.
- **IP Detail page — full port breakdown table** — all ports observed for the IP, with service name, protocol, bytes, flow count, and click-through to Flow Log filtered by IP + port. Scrollable, no arbitrary cap.
- **IP Detail page — CSV export** — downloads all flows for the IP in the selected time interval.
- **IP Detail page — time range from FilterBar** — interval is now URL-persisted, linkable, and uses the same presets as the rest of the app.
- **Compare page** (`/compare`) — pick two arbitrary time periods, optionally scope by IP/CIDR, and see side-by-side bandwidth bar chart, summary delta table (total/outbound/inbound/internal traffic, flow count, unique IPs), top destinations/sources delta, protocol breakdown delta, and CSV export of the comparison summary.
- **Compare nav link** — added to desktop and mobile navigation.
- **Flows CSV export API** (`/api/flows/export`) — authenticated-only, respects all active filters including direction and min-bytes.
- **IP flows CSV export API** (`/api/ip/[ip]/export`) — authenticated-only, exports all flows involving the given IP for the selected interval.

### Changed
- Dashboard, Flow Log, and IP Detail pages now use URL-persisted filter state via `useFilters` hook; filters survive page refresh and are shareable via URL.
- IP Detail API now returns `protocolBreakdown` and `portBreakdown` (all ports, with app names) alongside the existing data; peer limit raised to 50.

---

## [1.3.7] - 2026-03-02

### Fixed
- **Consistent obfuscation style site-wide**: Replaced `████` block characters (which rendered as invisible white boxes in ECharts' default font) with `*****` strings — matching the style that Destinations/Sources already used for obfuscated IPs.
- **Overlays removed from all widgets**: All `GuestOverlay` lock-icon overlays removed. Sensitive data is now redacted *inline* at the data level so the page structure remains navigable for guests.
- **Recent Flows / Flow Log IPs remain clickable**: Flow tables no longer have a blocking overlay — guests can click IP addresses to navigate to IP detail pages, while Proto, Port, Bytes, and Packets show `*****`.
- **Flow Log page table now properly redacted**: `isGuest` prop was missing from the `FlowTable` call — fixed.
- **Active Services / Active Applications**: Charts now receive `isGuest` directly; overlays removed.
- **Active IPs**: Overlays removed — IP obfuscation is handled by the backend for guests.

---

## [1.3.6] - 2026-03-02

### Fixed
- **Critical crash for guest users**: `AISummaryWidget` violated React's Rules of Hooks — `useCallback` and `useEffect` were declared after an early `return null`, causing React error #300 for every unauthenticated visitor. All hooks are now declared before any conditional return. A 401 guard was also added to silently suppress auth errors.

---

## [1.3.5] - 2026-03-02

### Fixed
- **Guest overlay reverted to semi-transparent style** — data is now correctly redacted *at source* so a heavy opaque overlay is no longer needed.
- **Chart legend data redacted for guests**: `TopPortsChart`, `ProtocolChart`, and `TopServicesCard` now accept an `isGuest` prop. When true, all legend labels (port numbers, service names, protocol names, application names) are replaced with `*****`. Tooltip values are also redacted. Donut colors/shapes remain so the page looks structured.
- **FlowTable columns redacted for guests**: Protocol, Port, Bytes, and Packets columns now show `*****` for unauthenticated users. Source/Dest IPs were already handled by the backend.
- **Dashboard Recent Flows covered**: Added guest overlay to the Recent Flows card at the bottom of the dashboard.
- **AI Summary hidden for guests**: `AISummaryWidget` returns `null` immediately for unauthenticated users via `useAuth` hook — no API call is made.

---

## [1.3.4] - 2026-03-02

### Added
- **Shared `useAuth` hook** (`hooks/useAuth.ts`): Single source of truth for auth state across all pages.
- **Shared `GuestOverlay` component** (`components/GuestOverlay.tsx`): Reusable frosted-glass blur overlay with Lock icon and Login CTA.

### Fixed
- **Global guest obfuscation**: All sensitive data is now consistently obfuscated for unauthenticated users across every page:
  - **Dashboard**: All 5 widgets (Destinations, Sources, Services, Protocol, Applications)
  - **Flow Log**: Entire flow table
  - **Active IPs**: Both destination and source IP charts
  - **Active Services**: Service/ports chart
  - **Active Applications**: Applications chart
  - **IP Detail page**: All 4 donut charts (Outgoing, Incoming, Services, Applications) + Flow Log table

---

## [1.3.3] - 2026-03-02

### Fixed
- **Guest obfuscation**: Services, Protocol Breakdown, and Applications widgets are now blurred for unauthenticated users. A frosted-glass overlay with a lock icon and a **Login** CTA is shown. Chart shapes remain visible so guests understand the page structure, but exact values are hidden.

---

## [1.3.2] - 2026-03-02

### Fixed
- **Dashboard widget icons**: Added lucide-react icons to all Top 10 widget headers — `ArrowUpRight` (blue) for Destinations, `ArrowDownLeft` (emerald) for Sources, `Server` (purple) for Services, `ArrowLeftRight` (amber) for Protocol Breakdown — matching the existing `Activity` icon on Top 10 Applications.

---

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
