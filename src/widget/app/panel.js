/**
 * Panel lateral de resultados (estilo lista de Google Maps), sincronizado con
 * el mapa: hover resalta el marker, click centra y abre el popup.
 */
window.Panel = (function () {
  'use strict';

  var esc = window.Utils.escapeHtml;
  var body = null;
  var title = null;
  var handlers = {};

  function init(callbacks) {
    handlers = callbacks || {};
    body = document.getElementById('panelBody');
    title = document.getElementById('panelTitle');

    window.Utils.on(document.getElementById('btnCollapse'), 'click', function () {
      var panel = document.getElementById('panel');
      var restoreBtn = document.getElementById('btnRestorePanel');
      panel.classList.add('panel-collapsed');
      if (restoreBtn) restoreBtn.hidden = false;
      if (handlers.onCollapse) handlers.onCollapse();
    });

    var restoreBtn = document.getElementById('btnRestorePanel');
    if (restoreBtn) {
      window.Utils.on(restoreBtn, 'click', function () {
        var panel = document.getElementById('panel');
        panel.classList.remove('panel-collapsed');
        restoreBtn.hidden = true;
        window.Utils.debounce(function () { window.MapView.resize(); }, 260)();
      });
    }

    var searchInput = document.getElementById('panelSearch');
    if (searchInput) {
      window.Utils.on(searchInput, 'input', function (e) {
        var term = (e.target.value || '').toLowerCase().trim();
        var cards = body.querySelectorAll('.card');
        
        cards.forEach(function (card) {
          if (!term) {
            card.style.display = '';
            return;
          }
          var text = card.textContent.toLowerCase();
          card.style.display = (text.indexOf(term) > -1) ? '' : 'none';
        });

        var groups = body.querySelectorAll('.group');
        groups.forEach(function (group) {
          var visibleCards = group.querySelectorAll('.card:not([style*="display: none"])');
          group.style.display = visibleCards.length > 0 ? '' : 'none';
        });
      });
    }
  }

  function tone(available) {
    if (available >= 4) return 'ok';
    if (available >= 1) return 'low';
    return 'none';
  }

  function card(item, isBuilding) {
    var el = document.createElement('div');
    el.className = 'card tone-' + tone(item.availablePorts) + (isBuilding ? ' card-building' : '');
    el.setAttribute('data-key', item.key);

    var html = '';
    html += '<div class="card-head">';
    html += '<span class="card-title">' + esc(item.label) + '</span>';
    html += '<span class="badge">' + esc(window.Utils.formatDistance(item.distance)) + '</span>';
    html += '</div>';
    html += '<div class="card-sub">' + esc(item.groupLabel) + (item.zoneLabel ? ' &middot; ' + esc(item.zoneLabel) : '') + '</div>';

    html += '<div class="card-ports">';
    html += '<span class="chip chip-' + tone(item.availablePorts) + '">' + esc(item.availablePorts) + ' disp.</span>';
    if (isBuilding) {
      html += '<span class="chip">' + esc(item.floors.length) + ' pisos</span>';
      html += '<span class="chip">' + esc(item.floorboxCount) + ' FBX</span>';
    } else {
      html += '<span class="chip">' + esc(item.occupiedPorts) + ' ocup.</span>';
    }
    html += '</div>';

    if (isBuilding && item.floors && item.floors.length > 0) {
      html += '<div class="card-body floors" style="display: none;">';
      item.floors.forEach(function (f) {
        html += '<div class="floor">';
        html += '<div class="floor-head">Piso ' + esc(f.level || '0') + '</div>';
        
        if (f.floorboxes && f.floorboxes.length > 0) {
          html += '<ul class="fbx-list">';
          f.floorboxes.forEach(function (fbx) {
            html += '<li class="fbx tone-' + tone(fbx.availablePorts) + '">';
            html += '<span>' + esc(fbx.label) + '</span> ';
            html += '<b class="fbx-ports">(' + esc(fbx.availablePorts) + '/' + esc(fbx.totalPorts) + ' disp.)</b>';
            html += '</li>';
          });
          html += '</ul>';
        } else {
          html += '<div class="fbx" style="color: var(--muted); font-style: italic;">Sin CTOs en este piso</div>';
        }
        
        if (f.fractions && f.fractions.length > 0) {
          html += '<div class="fractions">';
          f.fractions.forEach(function (frac) {
            html += '<span class="fraction">' + esc(frac) + '</span>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    el.innerHTML = html;

    window.Utils.on(el, 'mouseenter', function () {
      if (handlers.onHover) handlers.onHover(item.key, true);
    });
    window.Utils.on(el, 'mouseleave', function () {
      if (handlers.onHover) handlers.onHover(item.key, false);
    });
    
    var bodyEl = el.querySelector('.card-body');
    window.Utils.on(el, 'click', function (e) {
      if (bodyEl) {
        var isHidden = bodyEl.style.display === 'none';
        bodyEl.style.display = isHidden ? 'block' : 'none';
      }
      if (handlers.onSelect) handlers.onSelect(item.key);
    });

    return el;
  }

  function matchesFilters(item, filters) {
    if (filters.onlyAvailable && item.availablePorts <= 0) return false;
    return true;
  }

  function render(data, filters) {
    if (!body) return;

    var searchInput = document.getElementById('panelSearch');
    if (searchInput) {
      searchInput.value = '';
    }

    var total = 0;
    body.innerHTML = '';

    var groups = data.groups.filter(function (group) {
      return group.zones.some(function (zone) {
        return zone.closures.length || zone.buildings.length;
      });
    });

    if (!groups.length) {
      body.innerHTML = '<p class="empty">No se encontraron zonas en el radio consultado.</p>';
      if (title) title.textContent = 'Resultados (0)';
      return 0;
    }

    groups.forEach(function (group) {
      var wrapper = document.createElement('section');
      wrapper.className = 'group';

      var header = document.createElement('div');
      header.className = 'group-head';
      header.textContent = group.label;
      wrapper.appendChild(header);

      group.zones.forEach(function (zone) {
        var zoneHeader = document.createElement('div');
        zoneHeader.className = 'zone-head';
        zoneHeader.textContent = zone.label || 'Sin zona asignada';
        if (zone.type) {
          var tag = document.createElement('span');
          tag.className = 'zone-type';
          tag.textContent = zone.type;
          zoneHeader.appendChild(tag);
        }
        wrapper.appendChild(zoneHeader);

        zone.closures.forEach(function (item) {
          if (!matchesFilters(item, filters)) return;
          wrapper.appendChild(card(item, false));
          total += 1;
        });

        if (filters.showBuildings) {
          zone.buildings.forEach(function (item) {
            if (!matchesFilters(item, filters)) return;
            wrapper.appendChild(card(item, true));
            total += 1;
          });
        }
      });

      body.appendChild(wrapper);
    });

    if (!total) {
      body.innerHTML = '<p class="empty">Hay ubicaciones en el area, pero ninguna pasa los filtros activos.</p>';
    }

    if (title) title.textContent = 'Resultados (' + total + ')';
    return total;
  }

  function message(text) {
    if (!body) return;
    body.innerHTML = '<p class="empty">' + esc(text) + '</p>';
  }

  return {
    init: init,
    render: render,
    message: message
  };
})();