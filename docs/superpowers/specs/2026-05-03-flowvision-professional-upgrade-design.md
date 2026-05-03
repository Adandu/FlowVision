# FlowVision Professional Upgrade — Design Spec

**Date:** 2026-05-03
**Status:** Approved
**Scope:** Investigation-first redesign to bring FlowVision from homelab toy to small-business-worthy network monitoring tool.

---

## Problem Statement

FlowVision currently feels like a toy due to four specific gaps:
1. **Lack of details** — both overview numbers and detail pages are too shallow
2. **No filtering control** — you can't slice data by IP, port, protocol, or custom time range
3. **Not enough visualizations** — missing time-series per entity, relationship views, comparison views
4. **No export** — no way to take data out of the app

The goal is an **observation and investigation tool** — not a control plane. The app should give enough data to make informed decisions in OPNsense or elsewhere. No blocking, no acting — just deep, accurate, filterable information.

---

## Section 1 — Global Filter Bar

### What it is
A persistent filter bar appearing at the top of every data page: Dashboard, Flow Log, Active IPs, Active Services, Active Applications, IP Detail.

### Filter dimensions
| Field | Input type | Notes |
|-------|-----------|-------|
| Source IP | Text | Accepts exact IP or CIDR (e.g. `192.168.1.0/24`) |
| Destination IP | Text | Same |
| Port | Number | |
| Protocol | Dropdown | Any / TCP / UDP / ICMP |
| Country | Dropdown | Populated from observed traffic |
| Time range | Presets + custom picker | Live, 10m, 1h, 24h, 1w, 1mo + custom start/end datetime |

### Behaviour
- Active filters render as removable chips below the bar
- All filter state is encoded in URL query params — every filtered view is bookmarkable and shareable
- Applying a filter on the Dashboard re-fetches all widgets with the filter applied
- Navigating to another page carries filter state via URL params
- The existing per-page interval selector (Live / 10m / 1h / etc.) is **merged into** the filter bar's time range control — one place for all time context

---

## Section 2 — IP Detail Page (Investigation Hub)

The IP detail page is rebuilt as the primary investigation destination. Every clickable IP anywhere in the app lands here.

### Header band
IP address, reverse DNS, country flag + country name, ASN/ISP name, Public/Private badge, alias if configured.

### Bandwidth chart
Line/area chart showing inbound and outbound bandwidth over the selected time range as separate series. Answers: "was this IP always this busy or did it spike?"

### Traffic by protocol
Full table — every protocol observed for this IP:
| Column | Notes |
|--------|-------|
| Protocol | TCP, UDP, ICMP, etc. |
| Bytes | Exact |
| Packets | Exact |
| Flows | Exact |

Each row is clickable → opens the flow log pre-filtered to this IP + protocol.

### Traffic by port
Full table — every port observed for this IP (not top N — all):
| Column | Notes |
|--------|-------|
| Port | Number |
| Service name | Resolved from known services |
| Bytes | Exact |
| Packets | Exact |
| Flows | Exact |

Each row is clickable → opens the flow log pre-filtered to this IP + port.

### Top peers
Ranked table: peer IP, alias if known, direction (in/out/both), total bytes, last seen. Every peer IP is clickable — chains into a new IP detail investigation.

### Flow log
Existing flow table, pre-filtered to this IP, respecting global time range. Export button included (see Section 5).

All panels respect the global filter bar time range.

---

## Section 3 — Flow Log Upgrades

### Additional inline filters (flow-log-specific)
Two filters added directly on the Flow Log page, separate from the global bar:
- **Direction** — Inbound / Outbound / Internal / Any
- **Minimum bytes** — numeric input to filter out noise (e.g. show only flows over 1 MB)

### Export
- Button in top-right of the flow log
- Exports current view respecting all active filters and time range
- Format: CSV
- Columns: timestamp, source IP, source port, destination IP, destination port, protocol, bytes, packets, duration, direction, country, ASN
- Cap: 10,000 rows, row count shown before download so user knows what they're getting
- Filename format: `2026-05-03-flowvision-flows-24h.csv`

---

## Section 4 — Compare Page

A new page accessible from the navbar, labelled **"Compare"**.

### Time window selection
User picks two periods — Period A and Period B — each with start and end datetime.

**Presets:**
- Today vs Yesterday
- This Week vs Last Week
- This Hour vs Last Hour

### Bandwidth chart
Overlaid line chart showing bandwidth for Period A and Period B on the same chart. Inbound and outbound as separate series per period (4 lines total). Makes the visual delta immediately obvious.

### Side-by-side tables
All tables show exact numbers for Period A, Period B, and a delta column (absolute + percentage):

- **Top destinations** — new entries in B highlighted green, disappeared entries (in A not B) highlighted red
- **Top ports** — same treatment
- **Top protocols** — same treatment
- **Top source IPs** — same treatment

### Export
Export button produces a CSV with both periods side by side, one row per metric.
Filename format: `2026-05-03-flowvision-compare-week-vs-week.csv`

---

## Section 5 — Export Summary

| Location | Format | Cap | Filename example |
|----------|--------|-----|-----------------|
| Flow Log | CSV | 10,000 rows | `2026-05-03-flowvision-flows-24h.csv` |
| IP Detail — flow log panel | CSV | 10,000 rows | `2026-05-03-flowvision-ip-192.168.1.1-24h.csv` |
| Compare page | CSV | No cap (summary data) | `2026-05-03-flowvision-compare-week-vs-week.csv` |

All filenames start with `yyyy-mm-dd` for correct sorting in file managers.
No PDF export in this phase.

---

## What Is Not In Scope

- Scheduled/email reports (future phase)
- Blocking or acting on IPs from the UI
- Configurable dashboard widgets
- Saved filter presets
- Topology/relationship graphs
- PDF export

---

## Affected Files (estimated)

| Area | Files |
|------|-------|
| Global filter bar | New `FilterBar` component, all page files updated to consume filter state |
| URL filter state | New `useFilters` hook |
| IP Detail page | `web/src/app/ip/[ip]/page.tsx` full rewrite |
| IP Detail API | `web/src/app/api/ip/[ip]/route.ts` — new queries for protocol/port tables, peers |
| Flow Log page | `web/src/app/flow-log/page.tsx` — inline filters + export |
| Flow Log API | `web/src/app/api/flows/route.ts` — export endpoint |
| Compare page | New `web/src/app/compare/page.tsx` |
| Compare API | New `web/src/app/api/compare/route.ts` |
| Navbar | `web/src/components/Navbar.tsx` — add Compare link |
