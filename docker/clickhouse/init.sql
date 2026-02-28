CREATE TABLE IF NOT EXISTS flows
(
    timestamp DateTime64(3, 'UTC'),
    src_ip String,
    dst_ip String,
    src_port UInt16,
    dst_port UInt16,
    protocol UInt8,
    bytes UInt64,
    packets UInt64
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, src_ip, dst_ip)
TTL toDateTime(timestamp) + INTERVAL 6 MONTH DELETE;

-- Materialized Views for Fast Dashboard Aggregations --

-- 1 Minute Aggregation for Last 24h
CREATE MATERIALIZED VIEW IF NOT EXISTS flows_1m_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(minute)
ORDER BY (minute)
AS SELECT
    toStartOfMinute(timestamp) AS minute,
    sumState(bytes) AS bytes_sum,
    sumState(packets) AS packets_sum
FROM flows
GROUP BY minute;

-- 1 Hour Aggregation for longer periods
CREATE MATERIALIZED VIEW IF NOT EXISTS flows_1h_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour)
AS SELECT
    toStartOfHour(timestamp) AS hour,
    sumState(bytes) AS bytes_sum,
    sumState(packets) AS packets_sum
FROM flows
GROUP BY hour;
