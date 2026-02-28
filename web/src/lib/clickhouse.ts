import { createClient } from '@clickhouse/client';

const clickhouseHost = process.env.CLICKHOUSE_HOST || 'http://localhost:8123';
const clickhouseUser = process.env.CLICKHOUSE_USER || 'default';
const clickhousePassword = process.env.CLICKHOUSE_PASSWORD || '';

export const clickhouse = createClient({
    url: clickhouseHost,
    username: clickhouseUser,
    password: clickhousePassword,
    database: 'default',
    // Configure application-specific settings if necessary
    application: 'flowvision',
});
