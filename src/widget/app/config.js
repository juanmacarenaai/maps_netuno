/**
 * Configuracion del widget. Edita este archivo antes de compilar (npm run build).
 * NO coloques aqui credenciales del servicio: el navegador las veria.
 */
window.WIDGET_CONFIG = {
  /** Base del proxy Node (mismo origen en prod => deja vacio). */
  apiBase: 'http://localhost:3001/api/zoho/exp/v1/weezie/map',

  /** Timeout de la peticion al proxy (ms). */
  requestTimeoutMs: 20000,

  defaults: {
    lat: 9.042429,
    lng: -69.755618,
    radius: 200,
    radiusMdu: 200,
    zoom: 17
  },

  /** Capa de mosaicos. primary con fallback automatico a OpenStreetMap. */
  tiles: {
    primary: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      errorThreshold: 8
    },
    fallback: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }
  },

  /** Intenta leer lat/lng del registro de Zoho al cargar el widget. */
  autoReadFromRecord: true,
  recordFieldCandidates: {
    lat: ['Latitude', 'latitude', 'Latitud', 'lat', 'Latitude_Longitude'],
    lng: ['Longitude', 'longitude', 'Longitud', 'lng', 'Latitude_Longitude']
  },

  /** Umbrales de color para markers de closures. */
  availability: {
    high: 4,
    medium: 1
  },

  /** Radio de colocacion de markers (m) para desplazar puntos casi identicos. */
  overlapMeters: 6
};