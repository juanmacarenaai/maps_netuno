/**
 * Puente con el runtime de Zoho CRM. Todo es defensivo: el mismo codigo debe
 * servir en el editor de widgets, en un CRM Page y en un harness local.
 */
window.ZohoBridge = (function () {
  'use strict';

  function isZoho() {
    return typeof ZOHO !== 'undefined' && !!ZOHO && !!ZOHO.CRM;
  }

  function getRecord(callback) {
    if (!isZoho() || !ZOHO.CRM.PAGE || typeof ZOHO.CRM.PAGE.getRecord !== 'function') {
      callback(null);
      return;
    }
    try {
      ZOHO.CRM.PAGE.getRecord(function (response) {
        callback(response || null);
      });
    } catch (error) {
      callback(null);
    }
  }

  /** Un campo combinado tipo "9.042429, -69.755618" o "[9.04,-69.75]". */
  function parseCombined(value) {
    var text = String(value).trim().replace(/^[[(]|[\])]$/g, '');
    var parts = text.split(',');
    if (parts.length !== 2) return null;
    var lat = window.Utils.parseNumber(parts[0]);
    var lng = window.Utils.parseNumber(parts[1]);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat: lat, lng: lng };
  }

  function readField(record, candidates) {
    if (!record) return null;
    for (var i = 0; i < candidates.length; i += 1) {
      var value = record[candidates[i]];
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object') {
        if (value.latitude !== undefined || value.longitude !== undefined) {
          var lat = window.Utils.parseNumber(value.latitude);
          var lng = window.Utils.parseNumber(value.longitude);
          if (isFinite(lat) && isFinite(lng)) return { lat: lat, lng: lng };
        }
        if (value.formatted_address || value.value) {
          var nested = parseCombined(value.formatted_address || value.value);
          if (nested) return nested;
        }
        continue;
      }
      if (String(value).indexOf(',') !== -1) {
        var combined = parseCombined(value);
        if (combined) return combined;
      }
      var single = window.Utils.parseNumber(value);
      if (isFinite(single)) return single;
    }
    return null;
  }

  /**
   * Busca lat/lng en el registro usando la lista de candidatos de config.
   * @returns {Object|null} {lat, lng, source}
   */
  function getRecordCoordinates(callback) {
    if (!window.WIDGET_CONFIG.autoReadFromRecord) {
      callback(null);
      return;
    }

    getRecord(function (record) {
      if (!record) {
        callback(null);
        return;
      }

      var candidates = window.WIDGET_CONFIG.recordFieldCandidates || { lat: [], lng: [] };
      var latField = readField(record, candidates.lat || []);
      var lngField = readField(record, candidates.lng || []);

      if (latField && typeof latField === 'object' && isFinite(latField.lat)) {
        callback({ lat: latField.lat, lng: latField.lng, source: 'campo combinado' });
        return;
      }

      var lat = isFinite(latField) ? latField : null;
      var lng = isFinite(lngField) ? lngField : null;

      if (lat !== null && lng !== null) callback({ lat: lat, lng: lng, source: 'registro' });
      else callback(null);
    });
  }

  return {
    isZoho: isZoho,
    getRecord: getRecord,
    getRecordCoordinates: getRecordCoordinates
  };
})();