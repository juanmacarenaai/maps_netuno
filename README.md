# Mapa NAP Weezie — Widget Zoho CRM (Leaflet + OpenStreetMap)

Widget que, dada una latitud/longitud, consulta el servicio de ubicaciones
cercanas y las dibuja en un mapa Leaflet con mosaicos de OpenStreetMap/CARTO,
estilo lista de resultados tipo Google Maps.

```
.
├── proxy/                 # Node + Express (guarda las credenciales, cachea, normaliza)
│   ├── server.js
│   ├── config.js
│   ├── weezie.js
│   ├── normalize.js
│   ├── cache.js
│   └── rateLimit.js
├── src/
│   ├── widget/            # paquete que se sube a Zoho
│   │   ├── index.html
│   │   ├── app/*.js|css
│   │   └── vendor/leaflet/   (generado por npm run vendor)
│   └── dev/index.html     # harness para desarrollo local
├── tools/
│   ├── vendor.js
│   ├── build.mjs
│   └── smoke.js
└── dist/                  # (generado) widget empaquetado + zip
```

## Por qué hay un proxy

`client_secret` y `ZCFKEY` **no pueden ir en el widget**: el widget corre en el
navegador del usuario, así que cualquier clave ahí es pública. Además el
servicio no envía cabeceras CORS para `crm.zoho.*`. El proxy:

- inyecta los headers secretos (`client_id`, `client_secret`, `ZCFKEY`,
  `X-Original-Event-ID`),
- cachea en memoria (TTL configurable) para no golpear el servicio por cada
  zoom/clic,
- normaliza `same_area` / `other_area` / `outside_area` a una forma única,
- calcula `distance` en los MDUs (el servicio no lo envía),
- valida lat/lng/radio y aplica rate limit por IP.

## Puesta en marcha (local)

```bash
npm install
npm run vendor          # copia Leaflet al widget
cp .env.example .env    # y rellena las credenciales
npm start               # proxy en http://127.0.0.1:3001/api/zoho/exp/v1/weezie/map
```

Prueba rápida del proxy:

```bash
npm run smoke
# o
curl "http://127.0.0.1:3001/api/zoho/exp/v1/weezie/map/nearby?lat=9.042429&lng=-69.755618&radius=200&radius_mdu=200"
```

Para ver el widget en el navegador (fuera de Zoho), sirve la carpeta `src` y
abre `src/dev/index.html`; el harness ya apunta a `127.0.0.1:3001`.

```bash
npx serve src -l 8080     # o cualquier servidor estatico
```

## Empaquetar para Zoho

```bash
npm run build
```

Genera `dist/weezie-map-widget/` y `dist/weezie-map-widget.zip`. En Zoho CRM:

1. **Setup → Extension → Widgets → Create Widget**
2. Nombre del widget: `weezie-map-widget`.
3. Selecciona el tipo: *CRM Page* (dentro de un módulo), *Standalone* (pantalla
   completa) o *Global Widget*.
4. Sube el ZIP.
5. Agrega los subdominios permitidos donde se mostrará (p. ej.
   `crm.zoho.com`, y los regionales `.eu`, `.in`, `.com.au`, `.jp` si aplica).
6. Para un widget CRM Page: colócalo en la vista del módulo (Setup → tu
   módulo → Related Lists / Widgets) y asígnalo a un perfil.

## Configuración del widget

Todo en `src/widget/app/config.js` (edítalo y vuelve a ejecutar `npm run build`):

| Clave | Qué hace |
| --- | --- |
| `apiBase` | Base del proxy. Déjalo vacío si sirves el widget desde el mismo origen. |
| `tiles.primary` | Mosaico principal (CARTO Voyager). |
| `tiles.fallback` | OpenStreetMap estándar, se activa si fallan many tiles. |
| `recordFieldCandidates` | Campos donde se busca lat/lng del registro. |
| `autoReadFromRecord` | Si debe tomar lat/lng del registro al abrir. |
| `availability.high/medium` | Umbrales de color de los markers. |

## Campos de latitud/longitud en Zoho

`recordFieldCandidates.lat` / `.lng` traen candidatos por defecto
(`Latitude`, `latitude`, `Latitud`, `lat`, `Longitude`, …). El widget:

1. busca un par de campos numéricos;
2. si encuentra un campo combinado tipo `9.042429, -69.755618` (o un objeto
   `{latitude, longitude}`), lo usa;
3. si no encuentra nada, usa los valores por defecto de `config.defaults`.

En `src/dev/index.html` está desactivado (`autoReadFromRecord = false`).

## Despliegue del proxy

Opción recomendada: montarlo como una ruta más de tu API existente (nginx):

```nginx
location /api/zoho/exp/v1/weezie/map/ {
  proxy_pass http://127.0.0.1:3001;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Variables a definir en el servidor: `WEEZIE_CLIENT_ID`, `WEEZIE_CLIENT_SECRET`,
`WEEZIE_ZCFKEY`, `BASE_PATH`, `ALLOWED_ORIGINS`.

Sobre `ALLOWED_ORIGINS` (CORS): es una lista separada por comas con comodines,
p. ej. `https://*.zoho.com,https://*.zoho.eu`. Ajusta `*.zoho.*` solo si
realmente lo necesitas: cada origen permitido es una superficie de ataque.

Si varias instancias del proxy corre en paralelo, la cache y el rate limit son
por instancia; para compartir estado usa Redis.

## Notas

- El mapa no guarda las coordenadas consultadas en el navegador (sin
  `localStorage`); el único estado vive en memoria.
- `X-Original-Event-ID` se genera en el proxy si el cliente no lo manda.
- Rota `client_secret` cuando cambies el esquema de autenticación del servicio.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` | Levanta el proxy. |
| `npm run dev` | Levanta el proxy con recarga (`node --watch`). |
| `npm run vendor` | Copia Leaflet a `src/widget/vendor/leaflet`. |
| `npm run build` | Empaqueta el widget en `dist/`. |
| `npm run smoke` | Consulta el proxy y resume el JSON normalizado. |