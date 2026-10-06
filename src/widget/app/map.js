/**
 * Vista de mapa Leaflet: mosaicos con fallback, circulo de radio, marcador de
 * origen y markers de closures/edificios con desplazamiento de solapes.
 */
window.MapView = (function () {
  'use strict';

  var map = null;
  var markerLayer = null;
  var radiusLayer = null;
  var originMarker = null;
  var index = {};
  var tileLayer = null;
  var tileErrors = 0;
  var fallbackActive = false;

  function tilesConfig() {
    return (window.WIDGET_CONFIG && window.WIDGET_CONFIG.tiles) || {};
  }

  function addTileLayer() {
    var config = tilesConfig();
    var active = fallbackActive ? config.fallback : config.primary;
    if (!active || !active.url) return;

    tileLayer = L.tileLayer(active.url, {
      attribution: active.attribution,
      maxZoom: active.maxZoom || 19,
      detectRetina: true,
      crossOrigin: false
    });

    tileLayer.on('tileerror', function () {
      tileErrors += 1;
      var threshold = (config.primary && config.primary.errorThreshold) || 8;
      if (!fallbackActive && tileErrors > threshold) {
        fallbackActive = true;
        tileErrors = 0;
        if (tileLayer) map.removeLayer(tileLayer);
        addTileLayer();
      }
    });

    tileLayer.addTo(map);
    tileLayer.bringToBack();
  }

  function init(options) {
    var el = document.getElementById(options.container);
    var center = [options.lat, options.lng];

    map = L.map(el, {
      center: center,
      zoom: options.zoom || 17,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    addTileLayer();

    markerLayer = L.layerGroup().addTo(map);
    radiusLayer = L.layerGroup().addTo(map);

    if (window.ResizeObserver) {
      var observer = new ResizeObserver(function () {
        if (map) map.invalidateSize();
      });
      observer.observe(el);
    } else {
      window.Utils.on(window, 'resize', function () {
        if (map) map.invalidateSize();
      });
    }

    return map;
  }

  function clearMarkers() {
    index = {};
    if (markerLayer) markerLayer.clearLayers();
  }

  function setOrigin(lat, lng) {
    if (originMarker) map.removeLayer(originMarker);
    originMarker = L.marker([lat, lng], {
      icon: window.Markers.originIcon(),
      zIndexOffset: 1000,
      interactive: true,
      keyboard: false
    }).addTo(map);
    originMarker.bindPopup(
      '<div class="popup"><div class="popup-head"><span class="popup-title">Origen de la consulta</span></div>' +
      '<table class="kv"><tbody>' +
      '<tr><th>Latitud</th><td>' + window.Utils.formatNumber(lat, 6) + '</td></tr>' +
      '<tr><th>Longitud</th><td>' + window.Utils.formatNumber(lng, 6) + '</td></tr>' +
      '</tbody></table></div>'
    );
  }

  function drawRadius(lat, lng, radius, visible) {
    if (!radiusLayer) return;
    radiusLayer.clearLayers();
    if (!visible) return;

    L.circle([lat, lng], {
      radius: radius,
      color: '#1a73e8',
      weight: 1.5,
      opacity: 0.8,
      fillColor: '#1a73e8',
      fillOpacity: 0.07,
      dashArray: '6 6',
      interactive: false
    }).addTo(radiusLayer);
  }

  /**
   * Coloca markers evitando que se pisen cuando dos puntos casi coinciden.
   */
  function placePoints(items, isBuilding) {
    var overlap = (window.WIDGET_CONFIG && window.WIDGET_CONFIG.overlapMeters) || 6;
    var placed = [];
    var out = [];

    items.forEach(function (item) {
      var lat = item.lat;
      var lon = item.lon;
      var collided = 0;

      for (var i = 0; i < placed.length; i += 1) {
        var other = placed[i];
        if (L.latLng(lat, lon).distanceTo([other.lat, other.lon]) < overlap) collided += 1;
      }

      if (collided > 0) {
        var angle = (window.Utils.hashIndex(item.key) + collided * 137) % 360;
        var shifted = window.Utils.offset(lat, lon, overlap * (1 + Math.floor(collided / 6)), angle);
        lat = shifted[0];
        lon = shifted[1];
      }

      placed.push({ lat: lat, lon: lon });
      out.push({ item: item, lat: lat, lon: lon, isBuilding: isBuilding });
    });

    return out;
  }

  function render(data, options) {
    clearMarkers();
    drawRadius(data.query.lat, data.query.lng, data.query.radius, options.showRadius);

    var thresholds = (window.WIDGET_CONFIG && window.WIDGET_CONFIG.availability) || { high: 4, medium: 1 };
    var entries = [];

    data.points.closures.forEach(function (item) {
      if (options.onlyAvailable && item.availablePorts <= 0) return;
      entries.push({ item: item, isBuilding: false });
    });

    if (options.showBuildings) {
      data.points.buildings.forEach(function (item) {
        if (options.onlyAvailable && item.availablePorts <= 0) return;
        entries.push({ item: item, isBuilding: true });
      });
    }

    entries.sort(function (a, b) {
      var da = isFinite(a.item.distance) ? a.item.distance : Infinity;
      var db = isFinite(b.item.distance) ? b.item.distance : Infinity;
      return da - db;
    });

    var withFlag = entries.map(function (e) { return { item: e.item, isBuilding: e.isBuilding }; });
    var positioned = placePoints(withFlag.map(function (e) { return e.item; }), false);

    // placePoints devuelve coords ajustadas; reasociamos con la metadata original
    var markers = [];
    for (var i = 0; i < positioned.length; i += 1) {
      var meta = withFlag[i];
      var pos = positioned[i];
      var item = meta.item;

      var marker = L.marker([pos.lat, pos.lon], {
        icon: meta.isBuilding ? window.Markers.buildingIcon(item) : window.Markers.closureIcon(item, thresholds),
        title: item.label,
        riseOnHover: true,
        keyboard: true,
        alt: item.label + ' (' + item.availablePorts + ' puertos disponibles)'
      });

      marker.bindPopup(meta.isBuilding ? window.Popup.buildingHtml(item) : window.Popup.closureHtml(item), {
        maxWidth: 320,
        minWidth: 240,
        className: 'popup-wrapper',
        autoPanPadding: [24, 24]
      });

      marker.addTo(markerLayer);
      index[item.key] = marker;
      markers.push(marker);
    }

    var all = [L.latLng(data.query.lat, data.query.lng)].concat(
      markers.map(function (m) { return m.getLatLng(); })
    );

    if (markers.length) {
      map.fitBounds(all, { padding: [48, 48], maxZoom: 19 });
    } else {
      map.setView([data.query.lat, data.query.lng], 16);
    }

    return markers.length;
  }

  function focus(key) {
    var marker = index[key];
    if (!marker) return false;
    var target = marker.getLatLng();
    var zoom = Math.max(map.getZoom(), 18);
    map.setView(target, zoom, { animate: true, duration: 0.35 });
    marker.openPopup();
    return true;
  }

  function highlight(key, on) {
    var marker = index[key];
    if (!marker) return;
    var el = marker.getElement();
    if (!el) return;
    if (on) el.classList.add('pin-selected');
    else el.classList.remove('pin-selected');
  }

  function resize() {
    if (map) map.invalidateSize();
  }

  return {
    init: init,
    render: render,
    focus: focus,
    highlight: highlight,
    setOrigin: setOrigin,
    drawRadius: drawRadius,
    clearMarkers: clearMarkers,
    resize: resize
  };
})();