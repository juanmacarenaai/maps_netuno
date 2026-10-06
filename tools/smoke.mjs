/**
 * Smoke test contra el proxy local (o contra una URL base).
 *
 *   node tools/smoke.js
 *   API_BASE=https://picd.netuno.net/api/zoho/exp/v1/weezie/map node tools/smoke.js
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.API_BASE || 'http://127.0.0.1:3001/api/zoho/exp/v1/weezie/map';
const lat = process.env.LAT || '9.042429';
const lng = process.env.LNG || '-69.755618';
const radius = process.env.RADIUS || '200';

function loadEnv() {
  const file = path.join(root, '.env');
  if (!existsSync(file)) return;
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  });
}

async function main() {
  loadEnv();

  const health = await fetch(base + '/health');
  console.log('health:', health.status, JSON.stringify(await health.json()));

  const url = `${base}/nearby?lat=${lat}&lng=${lng}&radius=${radius}&radius_mdu=${radius}`;
  console.log('nearby:', url);

  const started = Date.now();
  const response = await fetch(url);
  const ms = Date.now() - started;
  const payload = await response.json();

  console.log('status:', response.status, '(' + ms + ' ms, cache=' + (response.headers.get('x-cache') || '-') + ')');

  if (!payload.ok) {
    console.error('error:', JSON.stringify(payload.error));
    process.exit(1);
  }

  console.log('stats:', JSON.stringify(payload.stats));
  payload.groups.forEach((group) => {
    const zones = group.zones.length;
    const closures = group.zones.reduce((acc, z) => acc + z.closures.length, 0);
    const buildings = group.zones.reduce((acc, z) => acc + z.buildings.length, 0);
    console.log(`  - ${group.label}: zonas=${zones} cajas=${closures} edificios=${buildings}`);
  });

  const first = payload.points.closures[0] || payload.points.buildings[0];
  if (first) console.log('  ejemplo:', first.label, '|', first.distance, 'm |', first.availablePorts, 'disp');
}

main().catch((error) => {
  console.error('smoke fallo: ' + error.message);
  process.exit(1);
});