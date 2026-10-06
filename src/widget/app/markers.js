/**
 * Marcadores: divIcon con HTML (sin imagenes) para no depender de assets.
 */
window.Markers = (function () {
  'use strict';

  function availabilityClass(available, thresholds) {
    if (available >= thresholds.high) return 'ok';
    if (available >= thresholds.medium) return 'low';
    return 'none';
  }

  function closureIcon(item, thresholds) {
    var tone = availabilityClass(item.availablePorts, thresholds);
    var html =
      '<div class="pin pin-closure tone-' + tone + '">' +
        '<span class="pin-count">' + window.Utils.escapeHtml(item.availablePorts) + '</span>' +
        '<span class="pin-caret"></span>' +
        '<span class="pin-label">' + window.Utils.escapeHtml(item.label) + '</span>' +
      '</div>';

    return L.divIcon({
      html: html,
      className: 'pin-wrapper',
      iconSize: [26, 36],
      iconAnchor: [13, 34],
      popupAnchor: [0, -32],
      labelAnchor: [13, 12]
    });
  }

  function buildingIcon(item) {
    var html =
      '<div class="pin pin-building">' +
        '<span class="pin-count">' + window.Utils.escapeHtml(item.availablePorts) + '</span>' +
        '<span class="pin-caret"></span>' +
        '<span class="pin-label">' + window.Utils.escapeHtml(item.label) + '</span>' +
      '</div>';

    return L.divIcon({
      html: html,
      className: 'pin-wrapper',
      iconSize: [26, 36],
      iconAnchor: [13, 34],
      popupAnchor: [0, -32]
    });
  }

  function originIcon() {
    return L.divIcon({
      html: '<div class="pin pin-origin"><span class="pin-dot"></span><span class="pin-label">Origen</span></div>',
      className: 'pin-wrapper',
      iconSize: [26, 36],
      iconAnchor: [13, 34],
      popupAnchor: [0, -32]
    });
  }

  return {
    closureIcon: closureIcon,
    buildingIcon: buildingIcon,
    originIcon: originIcon,
    availabilityClass: availabilityClass
  };
})();