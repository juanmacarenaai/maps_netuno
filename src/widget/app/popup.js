/**
 * Contenido de los popups: detalle de puertos por closure y por planta/edificio.
 */
window.Popup = (function () {
  'use strict';

  var esc = window.Utils.escapeHtml;

  function metersBadge(distance) {
    if (distance === null || distance === undefined || !isFinite(distance)) return '';
    return '<span class="badge">' + esc(window.Utils.formatDistance(distance)) + '</span>';
  }

  function portBar(available, total) {
    var pct = total > 0 ? Math.round((available / total) * 100) : 0;
    return (
      '<div class="portbar"><span class="portbar-fill" style="width:' + pct + '%"></span></div>' +
      '<div class="portbar-text">' +
        '<strong>' + esc(available) + '</strong> libres de ' + esc(total) + ' puertos' +
      '</div>'
    );
  }

  function closureHtml(item) {
    var html = '<div class="popup">';
    html += '<div class="popup-head"><span class="popup-title">' + esc(item.label) + '</span>' + metersBadge(item.distance) + '</div>';
    html += '<div class="popup-sub">' + esc(item.groupLabel) +
      (item.zoneLabel ? ' &middot; ' + esc(item.zoneLabel) : '') + '</div>';
    html += portBar(item.availablePorts, item.totalPorts);
    html += '<table class="kv"><tbody>' +
      '<tr><th>Disponibles</th><td>' + esc(item.availablePorts) + '</td></tr>' +
      '<tr><th>Ocupados</th><td>' + esc(item.occupiedPorts) + '</td></tr>' +
      '<tr><th>Puerto libre</th><td>' + esc(item.freePort) + '</td></tr>' +
      '<tr><th>ID</th><td>' + esc(item.id === null ? '-' : item.id) + '</td></tr>' +
      '<tr><th>UUID</th><td class="mono">' + esc(item.uuid || '-') + '</td></tr>' +
      '</tbody></table>';
    html += '</div>';
    return html;
  }

  function buildingHtml(item) {
    var html = '<div class="popup popup-wide">';
    html += '<div class="popup-head"><span class="popup-title">' + esc(item.label) + '</span>' + metersBadge(item.distance) + '</div>';
    html += '<div class="popup-sub">' + esc(item.groupLabel) +
      (item.zoneLabel ? ' &middot; ' + esc(item.zoneLabel) : '') + '</div>';
    html += portBar(item.availablePorts, item.totalPorts);

    html += '<table class="kv"><tbody>' +
      '<tr><th>Pisos</th><td>' + esc(item.floors.length) + '</td></tr>' +
      '<tr><th>Floorboxes</th><td>' + esc(item.floorboxCount) + '</td></tr>' +
      '<tr><th>Fracciones</th><td>' + esc(item.fractionCount) + '</td></tr>' +
      '<tr><th>Columnas</th><td>' + esc(item.columnCount) + '</td></tr>' +
      (item.adductionProgress ? '<tr><th>Adduccion</th><td>' + esc(item.adductionProgress) + '</td></tr>' : '') +
      '<tr><th>ID</th><td>' + esc(item.id === null ? '-' : item.id) + '</td></tr>' +
      '</tbody></table>';

    if (item.floors.length) {
      html += '<div class="floors">';
      item.floors.forEach(function (floor) {
        if (!floor.floorboxes.length && !floor.fractions.length) return;
        html += '<div class="floor">';
        html += '<div class="floor-head">Planta ' + esc(floor.level) + '</div>';

        if (floor.floorboxes.length) {
          html += '<ul class="fbx-list">';
          floor.floorboxes.forEach(function (fb) {
            var tone = fb.availablePorts > 0 ? 'ok' : 'none';
            html += '<li class="fbx tone-' + tone + '">' +
              '<span class="fbx-name">' + esc(fb.label) + '</span>' +
              '<span class="fbx-ports">' + esc(fb.availablePorts) + '/' + esc(fb.totalPorts) + '</span>' +
              '</li>';
          });
          html += '</ul>';
        }

        if (floor.fractions.length) {
          html += '<div class="fractions">' + floor.fractions.map(function (f) {
            return '<span class="fraction">' + esc(f) + '</span>';
          }).join('') + '</div>';
        }

        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  return {
    closureHtml: closureHtml,
    buildingHtml: buildingHtml
  };
})();