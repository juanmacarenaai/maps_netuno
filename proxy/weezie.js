'use strict';

const config = require('./config');
const { normalizeNearby } = require('./normalize');

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function buildUrl(query) {
  const url = new URL(config.upstream);
  url.searchParams.set('lat', String(query.lat));
  url.searchParams.set('lng', String(query.lng));
  url.searchParams.set('radius', String(query.radius));
  url.searchParams.set('radius_mdu', String(query.radiusMdu));
  return url.toString();
}

async function fetchNearby(query, eventId) {
  const { clientId, clientSecret, zcfKey, eventIdHeader } = config.credentials;

  if (!clientId || !clientSecret) {
    throw httpError(
      'Faltan credenciales del servicio. Configura WEEZIE_CLIENT_ID y WEEZIE_CLIENT_SECRET en el proxy.',
      500,
      'missing_credentials'
    );
  }

  const headers = {
    client_id: clientId,
    client_secret: clientSecret,
    'X-Original-Event-ID': eventId
  };
  if (zcfKey) headers.ZCFKEY = zcfKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);

  let response;
  try {
    response = await fetch(buildUrl(query), { method: 'GET', headers, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw httpError('El servicio no respondio a tiempo. Intenta de nuevo.', 504, 'upstream_timeout');
    }
    throw httpError('No se pudo conectar con el servicio: ' + error.message, 502, 'network_error');
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload && payload.message ? ': ' + payload.message : '';
    throw httpError('El servicio respondio HTTP ' + response.status + detail + '.', response.status === 404 ? 502 : response.status, 'upstream_http_error');
  }

  return normalizeNearby(payload, query);
}

module.exports = { fetchNearby };