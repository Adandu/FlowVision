# FlowVision — User Guide

## What is FlowVision?

FlowVision is a self-hosted, real-time Netflow analyzer built for homelabs and small networks. It receives NetFlow v5/v9 data from your router or firewall, stores it in ClickHouse, and provides a modern web dashboard for traffic analysis.

**Features:**
- Real-time bandwidth + traffic charts
- Top Sources, Top Destinations, Top Ports
- Protocol breakdown (TCP / UDP / ICMP)
- Traffic direction (Inbound / Outbound)
- IP detail drilldown with GeoIP + reverse DNS
- Flow log table (searchable, sortable)
- Alert rules with notifications (Discord, NTFY, Slack, Telegram, Email, Webhook, Apprise)
- User management with roles (Admin / Viewer)
- Timezone selector (GMT offset labels, sorted)
- OIDC support (via reverse proxy like Authelia / Authentik)

---

## Requirements

- Docker with Docker Compose
- A router/firewall that can export NetFlow v5 or v9 (OPNsense, pfSense, MikroTik, etc.)
- ~2GB RAM (ClickHouse is memory-hungry for larger datasets)
- Port 2055/UDP open toward the Docker host

---

## Installation (Single Container — Recommended)

### 1. Clone the repository

```bash
git clone https://github.com/yourname/flowvision.git
cd flowvision
```

### 2. Edit `docker-compose.yml`

Set your admin password and JWT secret:

```yaml
environment:
  AUTH_MODE: "local"          # Enable login page
  ADMIN_PASSWORD: "MySecureP@ss"   # Set BEFORE first run!
  JWT_SECRET: "a-random-32-char-secret-here"
```

> ⚠️ **Important:** Set `ADMIN_PASSWORD` and `JWT_SECRET` BEFORE running `docker compose up` for the first time. The admin user is created on first boot using these values. After first boot, change the password in your profile settings.

### 3. Build and start

```bash
docker compose build
docker compose up -d
```

The first build takes 5–10 minutes (downloads ClickHouse + Telegraf).

### 4. Access the web UI

Open `http://your-server-ip:3000` in your browser.  
Log in with username `admin` and the password you set in step 2.

---

## Configuring Your Router (NetFlow Export)

### OPNsense

1. Go to **Services → NetFlow**
2. Set **Listening interfaces** to your LAN/WAN
3. Set **Destination** to the IP of your FlowVision host
4. Set **Port** to `2055`
5. Set **Version** to `v5` or `v9`
6. Click Save and Apply

### pfSense

1. Install the **softflowd** package
2. Go to **Services → softflowd**
3. Set **Host** to your FlowVision host IP
4. Set **Port** to `2055`
5. Set **NetFlow Version** to `5`

### MikroTik

```
/ip traffic-flow
set enabled=yes interfaces=all
/ip traffic-flow target
add dst-address=<flowvision-host> port=2055 version=5
```

---

## Using the Dashboard

### Time Range
Use the buttons in the top-right (10 Mins / 1 Hour / 24 Hours / 1 Week / 1 Month) to change the time window.

### Timezone
Click the 🌐 timezone selector in the navbar. Choose your timezone (e.g., `Europe/Athens (GMT+2)`). The choice is saved automatically and persists across sessions.

### Clicking on an IP
Click any IP address in the pie charts or flow table to open the **IP Detail page**, showing:
- GeoIP data (country, city, ISP, flag)
- Reverse DNS hostname
- Bytes sent / received
- 24h bandwidth charts as source and destination
- Top peer connections
- Top ports used
- Last 100 flows

### Flow Log
Navigate to **Flow Log** for a full searchable + sortable table of the last 500 flows. Click any column header to sort. Use the search box to filter by IP, port, or protocol.

---

## Authentication Modes

| Mode | Description |
|---|---|
| `disabled` | No login required — anyone on the network can access |
| `local` | Username/password login via FlowVision login page |
| `proxy` | Trust `Remote-User` / `X-Forwarded-User` headers from Authelia/Authentik |

Set via `AUTH_MODE` environment variable in `docker-compose.yml`.

### Authelia / Authentik (proxy mode)

1. Set `AUTH_MODE=proxy` in docker-compose.yml
2. Configure Authelia/Authentik to forward authenticated users with `Remote-User: username` header to FlowVision
3. Protect the FlowVision service in your reverse proxy config

---

## Admin Panel

Access at `/admin` (requires admin role).

### User Management (`/admin/users`)
- Create users with username, password, display name, email, and role
- Roles: **Admin** (full access) / **Viewer** (read-only dashboard)
- Enable/disable users without deleting them
- Delete users

### Data Retention (`/admin/retention`)
Configure how many days of flow data to keep. Options: 7, 30, 90, 180, 365 days, or custom. Changes apply the ClickHouse TTL immediately. **Reducing retention will delete old data.**

### Notification Channels (`/admin/notifications`)
Add channels to receive alerts. Supported types:

| Type | Required Config |
|---|---|
| **Discord** | Webhook URL |
| **NTFY** | Server URL, Topic (optional: Access Token) |
| **Slack** | Webhook URL |
| **Telegram** | Bot Token, Chat ID |
| **Email** | SMTP Host, Port, Username, Password, From, To |
| **Webhook** | URL, HTTP Method |
| **Apprise** | Apprise API URL (optional: tag) |

Use the **Test** button to verify a channel before saving.

### OIDC / SSO (`/admin/oidc`)
For proxy-based SSO, set `AUTH_MODE=proxy` and configure the reverse proxy. The OIDC settings page stores configuration for future native OIDC support.

---

## Configuring Alerts

Go to **Alerts** in the top navigation.

1. Click **New Alert**
2. Set a name (e.g., "High bandwidth spike")
3. Choose type:
   - **Bandwidth Threshold** — triggers when total bytes/min exceeds threshold
   - **New Unknown IP Detected** — triggers on first flow from an unknown IP
   - **High Flow Count** — triggers when flows/min exceeds threshold
4. Set the threshold value
5. Click **Create Alert**

Alerts automatically send to all configured notification channels.

---

## User Profile

Click your avatar/initials in the top-right navbar to access your profile.

- **Display Name** — shown in the navbar
- **Interface Language** — English now; other languages coming soon
- **Default Timezone** — your preferred timezone for all timestamps
- **Change Password** — current + new password form

---

## Troubleshooting

**Q: I see no data on the dashboard**
- Check that your router is sending NetFlow to the correct IP/port
- Run `docker logs flowvision` and look for Telegraf output
- Check ClickHouse: `docker exec flowvision clickhouse-client --query "SELECT count() FROM flowvision.flows"`

**Q: Login fails with the correct password**
- Make sure `AUTH_MODE=local` is set in docker-compose.yml
- If you need to reset the admin password: `docker exec -it flowvision clickhouse-client --query "ALTER TABLE users DELETE WHERE username = 'admin'"`
  Then restart the container — admin will be re-created using `ADMIN_PASSWORD`

**Q: Timezone not saving**
- Timezone is stored in browser `localStorage`. Clear browser data and re-select.

**Q: Notification test fails**
- Check that the webhook URL / SMTP server is reachable from the Docker host
- For NTFY: ensure the topic exists and token (if needed) is correct
- For Telegram: ensure the bot has been started (`/start` in the chat)
