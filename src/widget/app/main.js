/**
 * Orquestacion del widget: formulario, consulta al proxy, render de mapa y
 * panel, lectura de lat/lng desde el registro de Zoho.
 */
(function () {
  'use strict';

  var $ = window.Utils.$;
  var on = window.Utils.on;

  var state = {
    data: null,
    inFlight: null,
    origin: null
  };

  function els() {
    return {
      lat: $('inputLat'),
      lng: $('inputLng'),
      radius: $('inputRadius'),
      radiusMdu: $('inputRadiusMdu'),
      search: $('btnSearch'),
      locate: $('btnLocate'),
      reset: $('btnReset'),
      onlyAvailable: $('chkAvailable'),
      showBuildings: $('chkBuildings'),
      showRadius: $('chkRadius'),
      status: $('status'),
      stats: $('stats'),
      toast: $('toast')
    };
  }

  function setStatus(text, kind) {
    var el = els().status;
    if (!el) return;
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' status-' + kind : '');
  }

  var toastTimer = null;
  function toast(message, kind) {
    var el = els().toast;
    if (!el) return;
    el.textContent = message;
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, 6000);
  }

  function readQuery() {
    var e = els();
    var lat = window.Utils.parseNumber(e.lat.value);
    var lng = window.Utils.parseNumber(e.lng.value);

    if (!isFinite(lat) || lat < -90 || lat > 90) return { error: 'Latitud invalida (debe estar entre -90 y 90).' };
    if (!isFinite(lng) || lng < -180 || lng > 180) return { error: 'Longitud invalida (debe estar entre -180 y 180).' };

    var radius = window.Utils.parseNumber(e.radius.value);
    var radiusMdu = window.Utils.parseNumber(e.radiusMdu.value);

    return {
      lat: lat,
      lng: lng,
      radius: isFinite(radius) ? window.Utils.clamp(radius, 10, 5000) : 200,
      radiusMdu: isFinite(radiusMdu) ? window.Utils.clamp(radiusMdu, 10, 5000) : 200
    };
  }

  function filters() {
    var e = els();
    return {
      onlyAvailable: !!e.onlyAvailable.checked,
      showBuildings: !!e.showBuildings.checked,
      showRadius: !!e.showRadius.checked
    };
  }

  function renderStats(data) {
    var el = els().stats;
    if (!el) return;

    var s = data.stats;
    var chips = [
      ['Cajas', s.closures],
      ['Cajas con puertos', s.closuresAvailable],
      ['Edificios', s.buildings],
      ['Floorboxes', s.floorboxes],
      ['Puertos libres', s.availablePorts],
      ['Puertos ocupados', s.occupiedPorts]
    ];

    el.innerHTML = chips.map(function (chip) {
      return '<span class="stat"><b>' + chip[1] + '</b>' + chip[0] + '</span>';
    }).join('') +
      '<span class="stat stat-muted">' +
        'Radio ' + data.query.radius + ' m / MDU ' + data.query.radiusMdu + ' m' +
        (data.cached ? ' &middot; cache' : '') +
      '</span>';

    el.hidden = false;
  }

  function apply(data) {
    var f = filters();
    window.MapView.setOrigin(data.query.lat, data.query.lng);
    var count = window.MapView.render(data, f);
    var panelCount = window.Panel.render(data, f);
    renderStats(data);
    return count + panelCount;
  }

  function rerender() {
    if (!state.data) return;
    apply(state.data);
  }

  function search() {
    var query = readQuery();
    if (query.error) {
      toast(query.error, 'error');
      return;
    }

    if (state.inFlight) state.inFlight.abort();

    els().search.disabled = true;
    setStatus('Consultando...', 'busy');

    state.inFlight = window.Api.nearby(query, function (error, data) {
      els().search.disabled = false;
      state.inFlight = null;

      if (error) {
        setStatus('');
        toast(error.message, 'error');
        window.Panel.message('No se pudo completar la consulta. ' + error.message);
        return;
      }

      state.data = data;
      state.origin = data.query;

      var f = filters();
      window.MapView.setOrigin(data.query.lat, data.query.lng);
      var markers = window.MapView.render(data, f);
      var panelCount = window.Panel.render(data, f);
      renderStats(data);

      var parts = [markers + ' en el mapa'];
      if (panelCount !== markers) parts.push(panelCount + ' en el panel');
      setStatus('Listo: ' + parts.join(' · '), 'ok');

      if (data.stats.withoutCoordinates > 0) {
        toast('Hay ' + data.stats.withoutCoordinates + ' ubicaciones sin coordenadas: no se pueden ubicar en el mapa.', 'warn');
      }
    });
  }

  function locate() {
    if (!navigator.geolocation) {
      toast('Este navegador no permite obtener la ubicacion.', 'error');
      return;
    }
    setStatus('Obteniendo ubicacion...', 'busy');
    navigator.geolocation.getCurrentPosition(
      function (position) {
        els().lat.value = position.coords.latitude.toFixed(6);
        els().lng.value = position.coords.longitude.toFixed(6);
        search();
      },
      function (error) {
        setStatus('');
        var message = error.code === 1 ? 'Permiso de ubicacion denegado.' : 'No se pudo obtener la ubicacion.';
        toast(message, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function reset() {
    var e = els();
    var defaults = window.WIDGET_CONFIG.defaults;
    e.lat.value = defaults.lat;
    e.lng.value = defaults.lng;
    e.radius.value = defaults.radius;
    e.radiusMdu.value = defaults.radiusMdu;
    state.data = null;
    window.MapView.clearMarkers();
    window.MapView.drawRadius(defaults.lat, defaults.lng, defaults.radius, true);
    window.MapView.setOrigin(defaults.lat, defaults.lng);
    window.Panel.message('Indica una latitud y longitud para buscar ubicaciones disponibles.');
    setStatus('');
    if (els().stats) els().stats.hidden = true;
  }

  function bind() {
    var e = els();

    on(e.search, 'click', search);
    on(e.locate, 'click', locate);
    on(e.reset, 'click', reset);

    [e.lat, e.lng].forEach(function (input) {
      on(input, 'keydown', function (event) {
        var code = event.keyCode || event.which;
        if (code === 13) search();
      });
    });

    on(e.onlyAvailable, 'change', rerender);
    on(e.showBuildings, 'change', rerender);
    on(e.showRadius, 'change', function () {
      if (!state.data) return;
      window.MapView.drawRadius(state.data.query.lat, state.data.query.lng, state.data.query.radius, e.showRadius.checked);
    });
  }

  function boot() {
    var defaults = window.WIDGET_CONFIG.defaults;
    var e = els();

    e.lat.value = defaults.lat;
    e.lng.value = defaults.lng;
    e.radius.value = defaults.radius;
    e.radiusMdu.value = defaults.radiusMdu;

    window.Panel.init({
      onHover: function (key, on_) { window.MapView.highlight(key, on_); },
      onSelect: function (key) { window.MapView.focus(key); },
      onCollapse: function () { window.Utils.debounce(function () { window.MapView.resize(); }, 260)(); }
    });

    window.MapView.init({ container: 'map', lat: defaults.lat, lng: defaults.lng, zoom: defaults.zoom });
    window.MapView.setOrigin(defaults.lat, defaults.lng);
    window.MapView.drawRadius(defaults.lat, defaults.lng, defaults.radius, true);

    bind();

    window.ZohoBridge.getRecordCoordinates(function (coords) {
      if (coords) {
        els().lat.value = coords.lat;
        els().lng.value = coords.lng;
        setStatus('Coordenadas tomadas del registro del usuario.', 'ok');
      }
      search();
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 0);
  } else {
    on(document, 'DOMContentLoaded', boot);
  }
})();