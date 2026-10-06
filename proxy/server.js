'use strict';

const express = require('express');
const config = require('./config');
const TtlCache = require('./cache');
const { createRateLimiter } = require('./rateLimit');
const { fetchNearby } = require('./weezie');

const app = express();
const cache = new TtlCache(config.cache.ttlMs, config.cache.maxEntries);
const limiter = createRateLimiter(config.rateLimit);

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '16kb' }));

const path = require('path');
app.use('/widget', express.static(path.join(__dirname, '../src/widget')));

function matchOrigin(pattern, origin) {
  if (pattern === '*') return true;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp('^' + escaped + '$', 'i').test(origin);
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  return config.allowedOrigins.some((pattern) => matchOrigin(pattern, origin));
}

app.use(function cors(req, res, next) {
  const origin = req.get('origin');

  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
    res.setHeader('Access-Control-Max-Age', '600');
    res.vary('Origin');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

function fail(res, status, code, message, extra) {
  return res.status(status).json(Object.assign({ ok: false, error: { code, message } }, extra || {}));
}

function parseCoord(raw, min, max) {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function parseRadius(raw, fallback) {
  const value = parseCoord(raw, config.limits.minRadius, config.limits.maxRadius);
  return value === null ? fallback : Math.round(value);
}

app.get(config.basePath + '/health', function health(req, res) {
  res.json({
    ok: true,
    service: 'weezie-map-proxy',
    credentialsConfigured: Boolean(config.credentials.clientId && config.credentials.clientSecret),
    cache: cache.stats(),
    time: new Date().toISOString()
  });
});

app.get(config.basePath + '/nearby', limiter, async function nearby(req, res) {
  const lat = parseCoord(req.query.lat, -90, 90);
  const lng = parseCoord(req.query.lng, -180, 180);

  if (lat === null || lng === null) {
    return fail(res, 400, 'invalid_coordinates', 'Las coordenadas son invalidas. Usa lat entre -90 y 90, y lng entre -180 y 180.');
  }

  const query = {
    lat,
    lng,
    radius: parseRadius(req.query.radius, config.limits.defaultRadius),
    radiusMdu: parseRadius(req.query.radius_mdu, config.limits.defaultRadiusMdu)
  };

  const cacheKey = [lat.toFixed(5), lng.toFixed(5), query.radius, query.radiusMdu].join('|');
  const hit = cache.get(cacheKey);
  if (hit) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(Object.assign({ cached: true }, hit));
  }

  const eventId = req.get('x-original-event-id') || 'map-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  try {
    const result = await fetchNearby(query, eventId);
    cache.set(cacheKey, result);
    res.setHeader('X-Cache', 'MISS');
    return res.json(Object.assign({ cached: false }, result));
  } catch (error) {
    return fail(res, error.status || 502, error.code || 'upstream_error', error.message, error.upstreamCode ? { upstreamCode: error.upstreamCode } : null);
  }
});

app.use(function notFound(req, res) {
  return fail(res, 404, 'not_found', 'Ruta no encontrada. Usa ' + config.basePath + '/nearby?lat=..&lng=..');
});

if (require.main === module) {
  app.listen(config.port, config.host, () => {
    console.log('[weezie-map-proxy] escuchando en http://' + config.host + ':' + config.port + config.basePath);
    console.log('[weezie-map-proxy] upstream: ' + config.upstream);
    console.log('[weezie-map-proxy] credenciales: ' + (config.credentials.clientId && config.credentials.clientSecret ? 'OK' : 'FALTAN (revisa .env)'));
  });
}

module.exports = app;