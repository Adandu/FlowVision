#!/bin/bash
set -e

# ─── Environment variables with defaults ──────────────────────────────────────
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
CLICKHOUSE_HOST_INTERNAL="http://localhost:8123"

echo "╔══════════════════════════════════════════════╗"
echo "║          FlowVision — Starting up            ║"
echo "╚══════════════════════════════════════════════╝"

# ─── Start ClickHouse in background to initialize ─────────────────────────────
echo "[entrypoint] Fixing permissions for ClickHouse directories..."
chown -R clickhouse:clickhouse /var/lib/clickhouse /var/log/clickhouse-server

echo "[entrypoint] Starting ClickHouse for initialization..."
su -s /bin/bash clickhouse -c "clickhouse-server --config-file=/etc/clickhouse-server/config.xml &"

# ─── Wait for ClickHouse to be ready ─────────────────────────────────────────
echo "[entrypoint] Waiting for ClickHouse..."
for i in $(seq 1 30); do
    if curl -sf "${CLICKHOUSE_HOST_INTERNAL}/ping" > /dev/null 2>&1; then
        echo "[entrypoint] ClickHouse is ready!"
        break
    fi
    sleep 2
done

# ─── Run database initialization SQL ─────────────────────────────────────────
echo "[entrypoint] Applying database schema..."
clickhouse-client --host localhost --query "$(cat /docker-entrypoint-initdb.d/init.sql)" 2>/dev/null || true

# ─── Apply additional tables (alerts, users, etc.) ───────────────────────────
clickhouse-client --host localhost --query "
CREATE TABLE IF NOT EXISTS alerts (id UUID DEFAULT generateUUIDv4(), created_at DateTime64(3, 'UTC') DEFAULT now64(), name String, type String, threshold UInt64, enabled UInt8 DEFAULT 1, trigger_count UInt64 DEFAULT 0, last_triggered Nullable(DateTime64(3, 'UTC'))) ENGINE = MergeTree ORDER BY (created_at);
CREATE TABLE IF NOT EXISTS alert_events (id UUID DEFAULT generateUUIDv4(), alert_id UUID, triggered_at DateTime64(3, 'UTC') DEFAULT now64(), value UInt64, message String) ENGINE = MergeTree ORDER BY (triggered_at) TTL toDateTime(triggered_at) + INTERVAL 30 DAY DELETE;
CREATE TABLE IF NOT EXISTS users (id UUID DEFAULT generateUUIDv4(), username String, email String DEFAULT '', password_hash String, role Enum8('admin'=1, 'viewer'=2) DEFAULT 'viewer', display_name String DEFAULT '', timezone String DEFAULT 'UTC', language String DEFAULT 'en', is_active UInt8 DEFAULT 1, created_at DateTime64(3,'UTC') DEFAULT now64(), last_login Nullable(DateTime64(3,'UTC'))) ENGINE = ReplacingMergeTree(created_at) ORDER BY (username);
CREATE TABLE IF NOT EXISTS groups (id UUID DEFAULT generateUUIDv4(), name String, description String DEFAULT '', permissions String DEFAULT '{}', created_at DateTime64(3,'UTC') DEFAULT now64()) ENGINE = ReplacingMergeTree(created_at) ORDER BY (name);
CREATE TABLE IF NOT EXISTS settings (key String, value String, updated_at DateTime64(3,'UTC') DEFAULT now64()) ENGINE = ReplacingMergeTree(updated_at) ORDER BY (key);
CREATE TABLE IF NOT EXISTS notification_channels (id UUID DEFAULT generateUUIDv4(), name String, type String, config String DEFAULT '{}', enabled UInt8 DEFAULT 1, created_at DateTime64(3,'UTC') DEFAULT now64()) ENGINE = ReplacingMergeTree(created_at) ORDER BY (name);
CREATE TABLE IF NOT EXISTS notification_log (id UUID DEFAULT generateUUIDv4(), channel_id UUID, alert_id UUID, sent_at DateTime64(3,'UTC') DEFAULT now64(), status String, error String DEFAULT '') ENGINE = MergeTree ORDER BY (sent_at) TTL toDateTime(sent_at) + INTERVAL 30 DAY DELETE;
" 2>/dev/null || true

# ─── Seed default settings ────────────────────────────────────────────────────
clickhouse-client --host localhost --query "
INSERT INTO settings (key, value)
SELECT key, value FROM
(
    SELECT 'retention_days' AS key, '180' AS value UNION ALL
    SELECT 'auth_mode', 'local' UNION ALL
    SELECT 'guest_mode_enabled', '0' UNION ALL
    SELECT 'oidc_enabled', '0' UNION ALL
    SELECT 'oidc_provider_url', '' UNION ALL
    SELECT 'oidc_client_id', '' UNION ALL
    SELECT 'oidc_client_secret', '' UNION ALL
    SELECT 'oidc_scopes', 'openid profile email' UNION ALL
    SELECT 'alerts_enabled', '0'
)
WHERE key NOT IN (SELECT key FROM settings FINAL);
" 2>/dev/null || true

# ─── Create default admin user (if no users exist yet) ───────────────────────
USER_COUNT=$(clickhouse-client --host localhost --query "SELECT count() FROM users FINAL" 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ]; then
    echo "[entrypoint] Creating default admin user..."
    # We use globally installed bcryptjs to hash the password
    HASH=$(node -e "const b=require('$(npm root -g)/bcryptjs');b.hash('${ADMIN_PASSWORD}',12).then(h=>process.stdout.write(h))" 2>/dev/null || echo "")
    if [ -n "$HASH" ]; then
        clickhouse-client --host localhost --query "INSERT INTO users (username, display_name, role, password_hash, is_active, email) VALUES ('admin','Administrator','admin','${HASH}',1,'')" 2>/dev/null || true
        echo "[entrypoint] ✓ Admin user created (username: admin)"
    else
        echo "[entrypoint] ⚠️ Failed to generate password hash. Admin user not created."
    fi
fi

# ─── Kill the background ClickHouse (supervisord will manage it properly) ─────
echo "[entrypoint] Stopping background ClickHouse..."
pkill -TERM -f clickhouse-server 2>/dev/null || true

# Wait until the process is actually gone (max 30 seconds)
max_wait=30
while pgrep -f clickhouse-server > /dev/null && [ $max_wait -gt 0 ]; do
    sleep 1
    max_wait=$((max_wait-1))
done

echo "[entrypoint] Setting up log directories..."
mkdir -p /var/log/flowvision
touch /var/log/flowvision/clickhouse{,-err}.log \
      /var/log/flowvision/telegraf{,-err}.log \
      /var/log/flowvision/nextjs{,-err}.log

echo "[entrypoint] Tailing logs to stdout for Docker..."
tail -F /var/log/flowvision/*.log > /dev/stdout &

echo "[entrypoint] Handing off to supervisord..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
