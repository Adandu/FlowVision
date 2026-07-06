# FlowVision — API Reference

All endpoints are relative to the base URL (e.g. `http://localhost:3000`).  
All POST/PATCH bodies use `Content-Type: application/json`.  
Authentication: JWT cookie `flowvision_token` (set by login, verified by the Next.js proxy). All routes require an authenticated session.

---

## Auth

### `POST /api/auth/login`
```json
body: { "username": "admin", "password": "secret" }
response: { "success": true, "user": { "id": "...", "username": "admin", "role": "admin", "display_name": "Administrator" } }
```
Sets `flowvision_token` HttpOnly cookie on success.

### `POST /api/auth/logout`
Clears the auth cookie. No body required.

### `GET /api/auth/me`
Returns current user from cookie.
```json
response: { "success": true, "user": { "id": "...", "username": "...", "role": "...", ... } }
```

---

## Flow Data

### `GET /api/flows?interval=1h`
Main dashboard data aggregation.
- `interval`: `10m`, `1h`, `24h`, `1w`, `1M`

```json
response: {
  "bandwidth": [{ "time": "2026-02-28T10:00:00Z", "bytes": 12345678 }, ...],
  "topDestinations": [{ "ip": "1.2.3.4", "bytes": 999 }, ...],
  "topSources": [...],
  "topPorts": [{ "port": 443, "protocol": 6, "bytes": 999 }, ...],
  "protocolBreakdown": [{ "protocol": "TCP", "bytes": 12345 }, ...],
  "trafficDirection": { "outbound": 12345678, "inbound": 9876 },
  "summary": { "totalBandwidth": 12345678, "activeIPs": 20, "activeServices": 10 }
}
```

### `GET /api/flows/recent?limit=100`
Returns last N raw flows (max 500).
```json
response: [{ "timestamp": "...", "src_ip": "...", "dst_ip": "...", "src_port": 12345, "dst_port": 443, "protocol": "TCP", "bytes": 140, "packets": 1 }]
```

---

## IP Info

### `GET /api/ip/[ip]`
Comprehensive per-IP statistics.
```json
response: {
  "summary": { "bytes_sent": 0, "bytes_received": 9300, "total_flows": 68, "first_seen": "...", "last_seen": "..." },
  "outTimeline": [{ "time": "...", "bytes": 0 }],
  "inTimeline": [{ "time": "...", "bytes": 300 }],
  "topPeersOut": [{ "ip": "...", "bytes": 0 }],
  "topPeersIn": [{ "ip": "192.168.30.5", "bytes": 9300 }],
  "topPorts": [{ "port": 443, "protocol": 6, "label": "TCP 443", "bytes": 9300 }],
  "recentFlows": [...]
}
```

### `GET /api/geoip/[ip]`
GeoIP lookup via ip-api.com (1h cache).
```json
response: { "country": "United States", "countryCode": "US", "flag": "🇺🇸", "city": "Ashburn", "isp": "Amazon.com", "as": "AS16509 Amazon.com", "lat": 39.0438, "lon": -77.4874 }
```

### `GET /api/rdns/[ip]`
Reverse DNS lookup (1h cache).
```json
response: { "hostname": "dns.google" }
// or
response: { "hostname": null }
```

---

## Alerts

### `GET /api/alerts`
```json
response: { "rules": [{ "id": "...", "name": "...", "type": "...", "threshold": 100, "enabled": 1 }], "events": [...] }
```

### `POST /api/alerts`
```json
body: { "name": "High bandwidth", "type": "bandwidth_threshold", "threshold": 104857600 }
```

### `DELETE /api/alerts?id=UUID`

---

## Admin (admin role required)

### `GET /api/admin/users`
### `POST /api/admin/users`
```json
body: { "username": "john", "password": "secure", "role": "viewer", "display_name": "John", "email": "j@example.com" }
```
### `DELETE /api/admin/users?id=UUID`
### `PATCH /api/admin/users`
```json
body: { "id": "UUID", "role": "admin", "is_active": 0 }
```

### `GET /api/admin/settings`
Returns all key-value settings as flat object.

### `PATCH /api/admin/settings`
```json
body: { "retention_days": "90", "oidc_enabled": "1" }
```

### `GET /api/admin/notifications`
Returns all notification channels (config parsed from JSON).

### `POST /api/admin/notifications`
Create: `{ "name": "...", "type": "discord", "config": { "webhook_url": "..." } }`  
Test: `{ "action": "test", "name": "...", "type": "discord", "config": { "webhook_url": "..." } }`

### `DELETE /api/admin/notifications?id=UUID`

### `POST /api/admin/apply-retention`
```json
body: { "days": 90 }
```
Runs `ALTER TABLE flows MODIFY TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE` on ClickHouse.

---

## Profile

### `GET /api/profile`
Returns current user profile.

### `PATCH /api/profile`
```json
body: { "display_name": "John", "timezone": "Europe/Athens", "language": "en" }
```

### `POST /api/profile/password`
```json
body: { "current_password": "old", "new_password": "newone123" }
```
