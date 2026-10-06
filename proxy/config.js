'use strict';

require('dotenv').config();

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const config = {
  port: num(process.env.PORT, 3001),
  host: process.env.HOST || '0.0.0.0',
  basePath: process.env.BASE_PATH || '/api/zoho/exp/v1/weezie/map',

  upstream: process.env.UPSTREAM_URL || 'https://picd.netuno.net/api/zoho/exp/v1/weezie/closures/nearby',
  upstreamTimeoutMs: num(process.env.UPSTREAM_TIMEOUT_MS, 15000),

  credentials: {
    clientId: process.env.WEEZIE_CLIENT_ID || '',
    clientSecret: process.env.WEEZIE_CLIENT_SECRET || '',
    zcfKey: process.env.WEEZIE_ZCFKEY || '',
    eventIdHeader: 'X-Original-Event-ID'
  },

  limits: {
    minRadius: 10,
    maxRadius: 5000,
    defaultRadius: 200,
    defaultRadiusMdu: 200
  },

  cache: {
    ttlMs: num(process.env.CACHE_TTL_MS, 300000),
    maxEntries: num(process.env.CACHE_MAX_ENTRIES, 500)
  },

  rateLimit: {
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    max: num(process.env.RATE_LIMIT_MAX, 60)
  },

  allowedOrigins: list(process.env.ALLOWED_ORIGINS, [
    'https://*.zoho.com',
    'https://*.zoho.eu',
    'https://*.zoho.in'
  ])
};

module.exports = config;