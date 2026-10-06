'use strict';

/**
 * Normaliza la respuesta del servicio NAP Weezie a una forma estable para el
 * widget. Motivo: `same_area` y `other_area` son arrays de zonas, mientras que
 * `outside_area` viene como { closures, mdus } sin envoltura de zona; ademas
 * los MDUs no traen `distance`, asi que la calculamos aqui con haversine.
 */

const EARTH_RADIUS_M = 6371000;

function num(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isNum(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function haversine(a, b) {
  if (!a || !b || !isNum(a.lat) || !isNum(a.lon) || !isNum(b.lat) || !isNum(b.lon)) return null;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * s2 * s2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
}

function pickCoords(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = num(raw.lat, NaN);
  const lon = num(raw.lon !== undefined && raw.lon !== null ? raw.lon : raw.lng, NaN);
  if (!isNum(lat) || !isNum(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** -1 -> 0 -> 1..n -> "P.B." (1000) para ordenar plantas de forma natural. */
function floorSortKey(level) {
  const raw = level === null || level === undefined ? '' : String(level).trim();
  if (/^-?\d+(\.\d+)?$/.test(raw)) return parseFloat(raw);
  return 1000;
}

function normalizeFloorbox(fbox) {
  const available = num(fbox.available_ports, 0);
  const occupied = num(fbox.occupied_ports, 0);
  return {
    id: fbox.fbox_id !== undefined ? fbox.fbox_id : null,
    label: fbox.fbox_label || 'FBX',
    active: fbox.fbx_active !== false,
    closureId: fbox.cl_id !== undefined ? fbox.cl_id : null,
    closureLabel: fbox.cl_label || null,
    availablePorts: available,
    occupiedPorts: occupied,
    totalPorts: available + occupied
  };
}

function normalizeFloor(floor) {
  const fractions = Array.isArray(floor.fractions)
    ? floor.fractions.map((f) => f && f.fraction_label).filter(Boolean)
    : [];
  return {
    id: floor.floor_id !== undefined ? floor.floor_id : null,
    level: floor.floor_level === null || floor.floor_level === undefined ? '' : String(floor.floor_level),
    sortKey: floorSortKey(floor.floor_level),
    floorboxes: (Array.isArray(floor.floorboxes) ? floor.floorboxes : []).map(normalizeFloorbox),
    fractions
  };
}

function normalizeClosure(closure, ctx) {
  const coords = pickCoords(closure.coordinates);
  const available = num(closure.available_ports, 0);
  const occupied = num(closure.occupied_ports, 0);
  return {
    kind: 'closure',
    key: 'closure:' + (closure.id !== undefined ? closure.id : closure.closure_uuid),
    id: closure.id !== undefined ? closure.id : null,
    uuid: closure.closure_uuid || null,
    label: closure.label || 'Closure',
    groupKey: ctx.groupKey,
    groupLabel: ctx.groupLabel,
    zoneLabel: ctx.zoneLabel,
    availablePorts: available,
    occupiedPorts: occupied,
    freePort: num(closure.free_port, 0),
    totalPorts: available + occupied,
    distance: isNum(closure.distance) ? Math.round(closure.distance * 100) / 100 : haversine(ctx.origin, coords),
    lat: coords ? coords.lat : null,
    lon: coords ? coords.lon : null
  };
}

function normalizeBuilding(mdu, ctx) {
  const plant = mdu && mdu.mdu_plant && typeof mdu.mdu_plant === 'object' ? mdu.mdu_plant : {};
  const coords = pickCoords(mdu.coordinates) || pickCoords(plant.coordinates);

  const floors = (Array.isArray(plant.floors) ? plant.floors : [])
    .map(normalizeFloor)
    .sort((a, b) => a.sortKey - b.sortKey || String(a.level).localeCompare(String(b.level)));

  const floorboxes = [];
  const fractions = [];
  floors.forEach((floor) => {
    floor.floorboxes.forEach((fb) => floorboxes.push(fb));
    floor.fractions.forEach((label) => fractions.push(label));
  });

  const availablePorts = floorboxes.reduce((acc, fb) => acc + fb.availablePorts, 0);
  const occupiedPorts = floorboxes.reduce((acc, fb) => acc + fb.occupiedPorts, 0);

  return {
    kind: 'building',
    key: 'building:' + (mdu.mdu_id !== undefined ? mdu.mdu_id : mdu.mdu_uuid),
    id: mdu.mdu_id !== undefined ? mdu.mdu_id : null,
    uuid: mdu.mdu_uuid || null,
    label: plant.building_label || 'Edificio',
    groupKey: ctx.groupKey,
    groupLabel: ctx.groupLabel,
    zoneLabel: ctx.zoneLabel,
    adductionProgress: plant.bd_adduction_progress || null,
    adductionType: plant.bd_adduction_type || null,
    hazards: plant.bd_adduction_hazards || null,
    demandPointAddress: plant.bd_demand_point_address || null,
    columnCount: Array.isArray(plant.columns) ? plant.columns.length : 0,
    availablePorts,
    occupiedPorts,
    totalPorts: availablePorts + occupiedPorts,
    floorboxCount: floorboxes.length,
    fractionCount: fractions.length,
    floors,
    fractions,
    distance: haversine(ctx.origin, coords),
    lat: coords ? coords.lat : null,
    lon: coords ? coords.lon : null
  };
}

function makeCtx(groupKey, groupLabel, zoneLabel, origin) {
  return { groupKey, groupLabel, zoneLabel, origin };
}

function buildZone(groupKey, groupLabel, zoneLabel, rawZone, origin, index) {
  const ctx = makeCtx(groupKey, groupLabel, zoneLabel, origin);
  return {
    key: groupKey + '#' + index,
    label: (rawZone && rawZone.anz_label) || null,
    type: (rawZone && rawZone.anz_type) || null,
    comment: (rawZone && rawZone.anz_comment) || null,
    locCode: (rawZone && rawZone.anz_loc_code) || null,
    closures: (Array.isArray(rawZone && rawZone.closures) ? rawZone.closures : []).map((c) => normalizeClosure(c, ctx)),
    buildings: (Array.isArray(rawZone && rawZone.mdus) ? rawZone.mdus : []).map((m) => normalizeBuilding(m, ctx))
  };
}

function buildGroups(data, origin) {
  const groups = [];

  [
    { key: 'same_area', label: 'Misma área' },
    { key: 'other_area', label: 'Otras áreas' }
  ].forEach((group) => {
    const raw = data[group.key];
    const zones = Array.isArray(raw)
      ? raw.map((zone, index) => buildZone(group.key, group.label, group.label, zone, origin, index))
      : [];
    groups.push({ key: group.key, label: group.label, zones });
  });

  const outside = data.outside_area && typeof data.outside_area === 'object' ? data.outside_area : {};
  const outsideLabel = 'Fuera del área';
  const ctx = makeCtx('outside_area', outsideLabel, outsideLabel, origin);
  groups.push({
    key: 'outside_area',
    label: outsideLabel,
    zones: [
      {
        key: 'outside_area#0',
        label: null,
        type: null,
        comment: null,
        locCode: null,
        closures: (Array.isArray(outside.closures) ? outside.closures : []).map((c) => normalizeClosure(c, ctx)),
        buildings: (Array.isArray(outside.mdus) ? outside.mdus : []).map((m) => normalizeBuilding(m, ctx))
      }
    ]
  });

  return groups;
}

function buildStats(groups) {
  const stats = {
    closures: 0,
    closuresAvailable: 0,
    buildings: 0,
    floorboxes: 0,
    availablePorts: 0,
    occupiedPorts: 0,
    withoutCoordinates: 0,
    minDistance: null
  };

  groups.forEach((group) => {
    group.zones.forEach((zone) => {
      zone.closures.forEach((closure) => {
        stats.closures += 1;
        if (closure.availablePorts > 0) stats.closuresAvailable += 1;
        stats.availablePorts += closure.availablePorts;
        stats.occupiedPorts += closure.occupiedPorts;
        if (closure.lat === null) stats.withoutCoordinates += 1;
        else if (stats.minDistance === null || closure.distance < stats.minDistance) stats.minDistance = closure.distance;
      });
      zone.buildings.forEach((building) => {
        stats.buildings += 1;
        stats.floorboxes += building.floorboxCount;
        stats.availablePorts += building.availablePorts;
        stats.occupiedPorts += building.occupiedPorts;
        if (building.lat === null) stats.withoutCoordinates += 1;
      });
    });
  });

  return stats;
}

function normalizeNearby(payload, query) {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('El servicio devolvio una respuesta vacia o no valida.');
    error.code = 'invalid_payload';
    error.status = 502;
    throw error;
  }

  if (typeof payload.code === 'number' && payload.code !== 0) {
    const error = new Error(payload.message || 'El servicio respondio con codigo ' + payload.code + '.');
    error.code = 'upstream_business_error';
    error.upstreamCode = payload.code;
    error.status = 502;
    throw error;
  }

  const origin = { lat: query.lat, lon: query.lng };
  const groups = buildGroups(payload.data && typeof payload.data === 'object' ? payload.data : {}, origin);

  const closures = [];
  const buildings = [];
  groups.forEach((group) => {
    group.zones.forEach((zone) => {
      zone.closures.forEach((item) => { if (item.lat !== null) closures.push(item); });
      zone.buildings.forEach((item) => { if (item.lat !== null) buildings.push(item); });
    });
  });

  return {
    ok: true,
    query: {
      lat: query.lat,
      lng: query.lng,
      radius: query.radius,
      radiusMdu: query.radiusMdu
    },
    upstreamMessage: payload.message || null,
    generatedAt: new Date().toISOString(),
    groups,
    points: { closures, buildings },
    stats: buildStats(groups)
  };
}

module.exports = { normalizeNearby, haversine };