/* Sintaxis ES5 para maxima compatibilidad con el sandbox de widgets de Zoho. */
window.Utils = (function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function on(el, event, handler) {
    if (!el) return;
    if (el.addEventListener) {
      el.addEventListener(event, handler, false);
    } else if (el.attachEvent) {
      el.attachEvent('on' + event, handler);
    }
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Acepta "9.042", "9,042", " -69.75 ". */
  function parseNumber(value) {
    if (value === null || value === undefined) return NaN;
    var text = String(value).trim().replace(',', '.');
    if (!text) return NaN;
    var parsed = Number(text);
    return isFinite(parsed) ? parsed : NaN;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatNumber(value, decimals) {
    if (value === null || value === undefined || !isFinite(value)) return '-';
    return Number(value).toFixed(decimals === undefined ? 0 : decimals);
  }

  function formatDistance(meters) {
    if (meters === null || meters === undefined || !isFinite(meters)) return '';
    if (meters < 1000) return Math.round(meters) + ' m';
    return (meters / 1000).toFixed(meters < 10000 ? 2 : 1) + ' km';
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, wait);
    };
  }

  /** Desplaza un par lat/lng N metros al azar determinista (para solapes). */
  function offset(lat, lon, meters, angle) {
    var rad = angle * Math.PI / 180;
    var dLat = (meters * Math.cos(rad)) / 111320;
    var dLon = (meters * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180));
    return [lat + dLat, lon + dLon];
  }

  /** Generador pseudoaleatorio estable (para offsets reproducibles). */
  function hashIndex(seed) {
    var text = String(seed);
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 100000;
    }
    return hash;
  }

  function debounceKey(key) {
    return String(key);
  }

  window.Utils = {
    $: $,
    on: on,
    escapeHtml: escapeHtml,
    parseNumber: parseNumber,
    clamp: clamp,
    formatNumber: formatNumber,
    formatDistance: formatDistance,
    debounce: debounce,
    offset: offset,
    hashIndex: hashIndex,
    debounceKey: debounceKey
  };

  return window.Utils;
})();