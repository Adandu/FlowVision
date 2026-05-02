# FlowVision — Developer & AI Agent Documentation

This document is intended for developers or AI agents that need to take over or extend the FlowVision codebase.

---

## Architecture Overview

```
[OPNsense / Router]
     │  NetFlow v5/v9 UDP :2055
     ▼
[Telegraf]  ── Starlark processor (field normalization) ──▶  [ClickHouse]
                                                                    │
                                                              [Next.js 16 API]
                                                                    │
                                                              [Next.js UI]
```

**All three services run in a single Docker container** managed by `supervisord`. ClickHouse stores all raw flows and aggregated materialized views. The Next.js app serves both the frontend and the backend API routes.

---

## Directory Structure

```
netflow-analyzer/
├── Dockerfile.all-in-one        # Single-image build (ClickHouse + Telegraf + Next.js)
├── supervisord.conf             # supervisord process config
├── entrypoint.sh                # Startup: wait for CH, init schema, create admin user
├── docker-compose.yml           # Single-service compose file
│
├── docker/
│   ├── clickhouse/init.sql      # Core schema (flows, materialized views)
│   └── telegraf/telegraf.conf   # NetFlow input + Starlark processor + CH output
│
├── docs/
│   ├── DEVELOPER.md             # This file
│   ├── USER_GUIDE.md            # End-user guide
│   └── API_REFERENCE.md         # API endpoint reference
│
└── web/                         # Next.js 16 application
    ├── src/
    │   ├── app/                 # App Router pages & API routes
    │   │   ├── page.tsx         # Dashboard (/)
    │   │   ├── login/           # Login page (/login)
    │   │   ├── profile/         # User profile page (/profile)
    │   │   ├── flow-log/        # Flow log table (/flow-log)
    │   │   ├── alerts/          # Alert rules (/alerts)
    │   │   ├── ip/[ip]/         # IP detail drilldown (/ip/:ip)
    │   │   ├── admin/           # Admin section (/admin/*)
    │   │   │   ├── page.tsx     # Admin hub
    │   │   │   ├── users/       # User management
    │   │   │   ├── retention/   # Data retention config
    │   │   │   ├── notifications/ # Notification channels
    │   │   │   └── oidc/        # OIDC/SSO config
    │   │   └── api/
    │   │       ├── auth/        # login, logout, me
    │   │       ├── flows/       # main flow data + /recent
    │   │       ├── ip/[ip]/     # Per-IP stats
    │   │       ├── geoip/[ip]/  # GeoIP lookup (ip-api.com)
    │   │       ├── rdns/[ip]/   # Reverse DNS
    │   │       ├── alerts/      # Alert rules CRUD
    │   │       ├── profile/     # Profile + password change
    │   │       └── admin/       # users, settings, notifications, apply-retention
    │   │
    │   ├── components/
    │   │   ├── Navbar.tsx       # Sticky nav: links + timezone selector (GMT+X sorted) + user menu
    │   │   ├── FlowTable.tsx    # Searchable/sortable paginated flow table
    │   │   └── charts/
    │   │       ├── BandwidthChart.tsx  # Line chart with timezone-aware x-axis
    │   │       ├── TopHostsChart.tsx   # Donut pie, clickable IP links
    │   │       ├── TopPortsChart.tsx   # Horizontal bar chart
    │   │       └── ProtocolChart.tsx   # TCP/UDP/ICMP donut
    │   │
    │   └── lib/
    │       ├── auth.ts          # bcrypt + jose JWT: hashPassword, verifyPassword, createToken, verifyToken, getCurrentUser
    │       ├── clickhouse.ts    # ClickHouse client singleton
    │       ├── notifications.ts # Notification dispatcher: Discord/NTFY/Slack/Telegram/Email/Webhook/Apprise
    │       └── timezone.tsx     # Timezone list (sorted by GMT offset), React context, useTimezone hook, formatTimestamp
    │
    └── proxy.ts                 # Auth enforcement: disabled / local (JWT) / proxy (headers)
```

---

## Database Schema

### `flows` — Raw NetFlow records
| Column | Type | Description |
|---|---|---|
| timestamp | DateTime64(3,'UTC') | Flow timestamp |
| src_ip | String | Source IP |
| dst_ip | String | Destination IP |
| src_port | UInt16 | Source port |
| dst_port | UInt16 | Destination port |
| protocol | UInt8 | IP protocol number (6=TCP, 17=UDP, 1=ICMP) |
| bytes | UInt64 | Bytes transferred |
| packets | UInt64 | Packet count |

TTL: 6 months by default (configurable via `/admin/retention`)

### `flows_1m_mv` — 1-minute aggregation (AggregatingMergeTree)
Fast aggregation for last 10m/1h views.

### `flows_1h_mv` — 1-hour aggregation (AggregatingMergeTree)
Fast aggregation for 24h/1w/1m views.

### `alerts` — Alert rules
| Column | Type |
|---|---|
| id | UUID |
| name | String |
| type | String (bandwidth_threshold / new_ip / high_flow_count) |
| threshold | UInt64 |
| enabled | UInt8 |
| trigger_count | UInt64 |

### `users` — User accounts
Uses `ReplacingMergeTree(created_at)` for upsert semantics. Always query with `FINAL`.
Roles: `admin` (value 1), `viewer` (value 2).

### `settings` — Key-value configuration
ReplacingMergeTree. Keys: `retention_days`, `auth_mode`, `oidc_enabled`, `oidc_provider_url`, `oidc_client_id`, `oidc_client_secret`, `oidc_scopes`.

### `notification_channels`
Stores channel config as JSON string in `config` column.

---

## Authentication Flow

1. `AUTH_MODE=disabled` → all routes pass through (no login required)
2. `AUTH_MODE=local` → the Next.js proxy reads `flowvision_token` HttpOnly cookie → verifies HS256 JWT with `JWT_SECRET` → if invalid, redirects to `/login`
3. `AUTH_MODE=proxy` → the Next.js proxy trusts `Remote-User` or `X-Forwarded-User` headers from reverse proxy

JWT payload: `{ sub: userId, role: 'admin'|'viewer', iat, exp }`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AUTH_MODE` | `disabled` | `disabled`, `local`, or `proxy` |
| `ADMIN_PASSWORD` | `changeme` | Initial admin password (first boot only) |
| `JWT_SECRET` | (weak default) | HMAC secret for JWT signing — **change in production** |
| `CLICKHOUSE_HOST` | `http://localhost:8123` | ClickHouse HTTP endpoint |
| `CLICKHOUSE_USER` | `default` | ClickHouse username |
| `CLICKHOUSE_PASSWORD` | `` | ClickHouse password |

---

## Adding a New Notification Channel

1. Add a new `case` in `web/src/lib/notifications.ts` `sendNotification()` switch
2. Add the channel type entry (with its config fields) to `CHANNEL_TYPES` array in `web/src/app/admin/notifications/page.tsx`
3. No backend changes needed — the API is generic

---

## Adding a New Chart to the Dashboard

1. Create `web/src/components/charts/MyChart.tsx`
2. Import dynamically in `web/src/app/page.tsx` with `dynamic(() => import(...), { ssr: false })`
3. Add the required query to `web/src/app/api/flows/route.ts`
4. Pass data as prop to chart component

---

---

## Guest Obfuscation Implementation

When adding new charts or tables that display sensitive data, you **must** implement obfuscation for unauthenticated guests:

1. **Check Auth State**: Use the `useAuth()` hook in your page or component.
2. **Propagate `isGuest`**: Pass `isGuest={isLoggedIn === false}` to the component.
3. **Redact in Component**:
   - For **ECharts**: Replace legend/tooltip labels with `*****` strings. Do not use block characters like `████` as they may not render in default browser fonts within the canvas.
   - For **Tables**: Wrap sensitive cell content in a conditional: `{isGuest ? '*****' : data}`.
4. **IPs**: Backend already obfuscates IPs for guests. Retain clickable links to `/ip/[ip]` as the detail page also handles obfuscation.

---

## AI Integration Architecture

FlowVision uses a multi-provider AI summary feature:

- **Settings**: Stored in ClickHouse `settings` table (`ai_enabled`, `ai_provider`, `ai_gemini_key`, etc.).
- **Backend API**: `/api/ai/summary` fetches traffic metrics, constructs a prompt, and calls the active AI provider (Gemini, Claude, or OpenAI).
- **Frontend**: `AISummaryWidget.tsx` renders the output. It **must** hide itself for guests to prevent leaked metadata or API costs.
- **Security**: API keys are never sent to the frontend.

---

## Telegraf → ClickHouse Data Flow

Telegraf runs with the `netflow` input plugin (UDP :2055) and a Starlark processor that:
- Reads NetFlow v5 fields: `src`, `dst`, `in_bytes`, `in_packets`, `protocol` (string), `src_port`, `dst_port`
- Maps protocol string → UInt8 (TCP=6, UDP=17, ICMP=1)
- Outputs to the ClickHouse `flows` table via HTTP

Key file: `docker/telegraf/telegraf.conf`
