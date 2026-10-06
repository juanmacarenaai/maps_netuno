/**
 * Cliente HTTP del widget. Usa XMLHttpRequest (no fetch) por maxima
 * compatibilidad con el sandbox de widgets de Zoho.
 */
window.Api = (function () {
  'use strict';

  function buildUrl(params) {
    var base = (window.WIDGET_CONFIG.apiBase || '').replace(/\/+$/, '');
    var url = base + '/nearby?lat=' + encodeURIComponent(params.lat) +
      '&lng=' + encodeURIComponent(params.lng) +
      '&radius=' + encodeURIComponent(params.radius) +
      '&radius_mdu=' + encodeURIComponent(params.radiusMdu);
    return url;
  }

  /**
   * @param {{lat:number,lng:number,radius:number,radiusMdu:number}} params
   * @param {function(Object, Object=)} callback  callback(null, data) | callback(error)
   * @returns {{abort:function}}
   */
  function nearby(params, callback) {
    var timeout = (window.WIDGET_CONFIG && window.WIDGET_CONFIG.requestTimeoutMs) || 20000;
    var request = new XMLHttpRequest();
    var settled = false;

    function fail(message, code) {
      if (settled) return;
      settled = true;
      callback({ message: message, code: code || 'request_failed' });
    }

    request.open('GET', buildUrl(params), true);
    request.timeout = timeout;

    request.onload = function () {
      if (settled) return;

      if (request.status === 0) {
        return fail('No se pudo alcanzar el servidor. Revisa la conexion o la configuracion de CORS del proxy.');
      }

      var payload = null;
      try {
        payload = JSON.parse(request.responseText);
      } catch (error) {
        payload = null;
      }

      if (request.status >= 200 && request.status < 300) {
        if (!payload || payload.ok !== true) {
          return fail((payload && payload.error && payload.error.message) || 'El proxy respondio con un formato inesperado.');
        }
        settled = true;
        return callback(null, payload);
      }

      var errorMessage = (payload && payload.error && payload.error.message) ||
        'El proxy respondio HTTP ' + request.status + '.';
      return fail(errorMessage, (payload && payload.error && payload.error.code) || 'http_' + request.status);
    };

    request.onerror = function () {
      fail('No se pudo alcanzar el servidor. Revisa la conexion o la configuracion de CORS del proxy.');
    };

    request.ontimeout = function () {
      fail('La consulta tardo demasiado. Revisa que el proxy este disponible.');
    };

    request.send();

    return {
      abort: function () {
        if (!settled) {
          settled = true;
          try { request.abort(); } catch (error) { /* noop */ }
        }
      }
    };
  }

  return { nearby: nearby };
})();