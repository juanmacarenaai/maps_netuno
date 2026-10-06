/**
 * Empaqueta src/widget en dist/<WIDGET_NAME>/ y genera el ZIP para subir a
 * Zoho CRM (Setup > Extension > Widgets > Create Widget).
 *
 * Uso: node tools/build.mjs [nombre-del-widget]
 */
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src', 'widget');
const distDir = path.join(root, 'dist');
const name = process.argv[2] || 'weezie-map-widget';
const outDir = path.join(distDir, name);
const zipPath = path.join(distDir, name + '.zip');

async function main() {
  if (!existsSync(path.join(srcDir, 'index.html'))) {
    throw new Error('No existe src/widget/index.html');
  }
  if (!existsSync(path.join(srcDir, 'vendor', 'leaflet', 'leaflet.js'))) {
    throw new Error('Falta vendor/leaflet/leaflet.js. Ejecuta "npm run vendor".');
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(srcDir, outDir, { recursive: true });

  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  await writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify({ name, version: pkg.version, builtAt: new Date().toISOString() }, null, 2)
  );

  const archiver = require('archiver');
  await new Promise((resolve, reject) => {
    const output = require('node:fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(outDir, false);
    archive.finalize();
  });

  console.log('[build] carpeta: ' + path.relative(root, outDir));
  console.log('[build] zip para Zoho: ' + path.relative(root, zipPath));
}

main().catch((error) => {
  console.error('[build] ' + error.message);
  process.exit(1);
});