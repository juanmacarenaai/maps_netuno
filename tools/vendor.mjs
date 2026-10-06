/**
 * Copia Leaflet (y sus imagenes) desde node_modules al widget para que el
 * paquete de Zoho sea autocontenido. Ejecutar: npm run vendor
 */
import { cp, mkdir, rm, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'src', 'widget', 'vendor', 'leaflet');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let dist;
  try {
    dist = path.dirname(require.resolve('leaflet/dist/leaflet.js'));
  } catch {
    console.error('[vendor] Leaflet no esta instalado. Ejecuta "npm install" primero.');
    process.exit(1);
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  await cp(path.join(dist, 'leaflet.js'), path.join(target, 'leaflet.js'));
  await cp(path.join(dist, 'leaflet.css'), path.join(target, 'leaflet.css'));
  await cp(path.join(dist, 'images'), path.join(target, 'images'), { recursive: true });

  console.log('[vendor] Leaflet copiado a src/widget/vendor/leaflet');
}

main().catch((error) => {
  console.error('[vendor] ' + error.message);
  process.exit(1);
});