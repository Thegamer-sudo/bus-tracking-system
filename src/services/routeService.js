// src/services/routeService.js
// Session 1 update — wires cacheLastBusPosition into listenToBus and listenToAllBuses
// All existing logic is preserved exactly.

import { db } from '../config/firebase';
import { doc, setDoc, onSnapshot, collection, serverTimestamp } from 'firebase/firestore';
import { ROUTES } from '../config/constants';
import { cacheLastBusPosition } from './offlineService';

const OSRM_BASE = 'http://router.project-osrm.org/route/v1/driving';

// ─────────────────────────────────────────────────────────────────────────────
// POLYLINE DECODER
// ─────────────────────────────────────────────────────────────────────────────

export function decodePolyline(encoded) {
  if (!encoded) return [];
  let index = 0, lat = 0, lng = 0;
  const coords = [];
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function isValidStop(stop) {
  return stop &&
    typeof stop.latitude  === 'number' && !isNaN(stop.latitude) &&
    typeof stop.longitude === 'number' && !isNaN(stop.longitude);
}

// ─────────────────────────────────────────────────────────────────────────────
// OSRM — single segment
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchOSRMSegment(stopA, stopB) {
  try {
    if (!isValidStop(stopA) || !isValidStop(stopB)) {
      console.warn('Invalid stop:', stopA, stopB);
      return null;
    }
    const url = `${OSRM_BASE}/${stopA.longitude},${stopA.latitude};${stopB.longitude},${stopB.latitude}?overview=full&geometries=polyline`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes.length > 0) {
      return {
        coords:       decodePolyline(data.routes[0].geometry),
        distance_km:  data.routes[0].distance / 1000,
        duration_min: data.routes[0].duration / 60,
      };
    }
    console.warn('OSRM segment not found for:', stopA.name, '->', stopB.name);
    return null;
  } catch (e) {
    console.error('OSRM fetch failed:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OSRM — multi-waypoint
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchOSRMRoute(waypoints) {
  try {
    if (!waypoints || waypoints.length < 2) return null;
    for (const w of waypoints) {
      if (!isValidStop(w)) { console.warn('Invalid waypoint:', w); return null; }
    }
    const coordStr = waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');
    const url      = `${OSRM_BASE}/${coordStr}?overview=full&geometries=polyline`;
    const res      = await fetch(url);
    const data     = await res.json();
    if (data.code === 'Ok' && data.routes.length > 0) {
      return {
        coords:       decodePolyline(data.routes[0].geometry),
        distance_km:  data.routes[0].distance / 1000,
        duration_min: data.routes[0].duration / 60,
      };
    }
    return null;
  } catch (e) {
    console.error('fetchOSRMRoute failed:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD FULL ROUTE
// ─────────────────────────────────────────────────────────────────────────────

export async function buildFullRoute(stops) {
  if (!stops || stops.length < 2) {
    console.error('Cannot build route: need at least 2 stops');
    return { allCoords: [], segmentData: [] };
  }
  console.log('Building route with OSRM for', stops.length, 'stops');

  let allCoords = [];
  const segmentData = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const stopA = stops[i];
    const stopB = stops[i + 1];
    console.log(`Fetching segment ${i + 1}: ${stopA.name} → ${stopB.name}`);

    const result = await fetchOSRMSegment(stopA, stopB);

    if (result && result.coords.length > 0) {
      segmentData.push({ stopIndex: i, ...result });
      allCoords = i === 0
        ? [...allCoords, ...result.coords]
        : [...allCoords, ...result.coords.slice(1)];
      console.log(`  ✓ Segment ${i + 1}: ${result.coords.length} pts, ${result.distance_km.toFixed(2)}km`);
    } else {
      // Straight-line fallback
      console.log(`  ✗ OSRM failed for segment ${i + 1}, using straight line`);
      const coords = [
        { latitude: stopA.latitude, longitude: stopA.longitude },
        { latitude: stopB.latitude, longitude: stopB.longitude },
      ];
      segmentData.push({ stopIndex: i, coords, distance_km: 0, duration_min: 0 });
      allCoords = i === 0
        ? [...allCoords, ...coords]
        : [...allCoords, ...coords.slice(1)];
    }

    // Rate-limit OSRM calls
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`Route built: ${allCoords.length} total coordinate points`);
  return { allCoords, segmentData };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE — bus position write
// ─────────────────────────────────────────────────────────────────────────────

export async function updateBusPosition(busId, latitude, longitude, stopIndex, status, direction) {
  if (!busId) return;
  try {
    await setDoc(doc(db, 'buses', busId), {
      latitude:          latitude  ?? null,
      longitude:         longitude ?? null,
      currentStopIndex:  stopIndex ?? 0,
      status:            status    ?? 'ON_TIME',
      direction:         direction ?? 'outbound',
      updatedAt:         serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.error('Bus position update failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE — listen to a single bus
// Session 1 change: also writes to offline cache on every update
// ─────────────────────────────────────────────────────────────────────────────

export function listenToBus(busId, callback) {
  return onSnapshot(doc(db, 'buses', busId), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback(data);
      // Write to offline cache so users can see last position when offline
      cacheLastBusPosition(busId, data).catch(() => {});
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE — listen to all buses
// Session 1 change: also writes each bus to offline cache
// ─────────────────────────────────────────────────────────────────────────────

export function listenToAllBuses(callback) {
  return onSnapshot(collection(db, 'buses'), (snap) => {
    const allBuses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(allBuses);
    // Cache each bus position individually
    allBuses.forEach(bus => {
      cacheLastBusPosition(bus.id, bus).catch(() => {});
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE MATCHING — which routes serve a stop
// ─────────────────────────────────────────────────────────────────────────────

export function getRoutesForStop(stopName) {
  const routes = [];
  for (const [routeId, routeData] of Object.entries(ROUTES)) {
    const allStops = [...routeData.outboundStops, ...routeData.inboundStops];
    const found    = allStops.find(s => s.name === stopName);
    if (found) {
      routes.push({
        routeId,
        routeName:  routeData.name,
        stop:       found,
        direction:  routeData.outboundStops.find(s => s.name === stopName) ? 'outbound' : 'inbound',
      });
    }
  }
  return routes;
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY PLANNER — direct + transfer routes
// ─────────────────────────────────────────────────────────────────────────────

export function findRoutesForJourney(originStopName, destStopName) {
  const results = [];

  for (const [routeId, routeData] of Object.entries(ROUTES)) {
    const outNames = routeData.outboundStops.map(s => s.name);
    const inNames  = routeData.inboundStops.map(s => s.name);

    // Outbound direct
    if (outNames.includes(originStopName) && outNames.includes(destStopName)) {
      const oIdx = outNames.indexOf(originStopName);
      const dIdx = outNames.indexOf(destStopName);
      if (oIdx < dIdx) {
        const stops = dIdx - oIdx;
        results.push({
          type: 'direct', routeId, routeName: routeData.name, color: routeData.color,
          direction: 'outbound', originStop: originStopName, destStop: destStopName,
          stopsBetween: stops,
          fare: routeData.baseFare + (stops - 1) * routeData.farePerStop,
        });
      }
    }

    // Inbound direct
    if (inNames.includes(originStopName) && inNames.includes(destStopName)) {
      const oIdx = inNames.indexOf(originStopName);
      const dIdx = inNames.indexOf(destStopName);
      if (oIdx < dIdx) {
        const stops = dIdx - oIdx;
        results.push({
          type: 'direct', routeId, routeName: routeData.name, color: routeData.color,
          direction: 'inbound', originStop: originStopName, destStop: destStopName,
          stopsBetween: stops,
          fare: routeData.baseFare + (stops - 1) * routeData.farePerStop,
        });
      }
    }
  }

  // Transfer via City Terminus hub
  const toHub   = [];
  const fromHub = [];

  for (const [routeId, routeData] of Object.entries(ROUTES)) {
    const outNames = routeData.outboundStops.map(s => s.name);

    if (outNames.includes(originStopName) && outNames.includes('City Terminus')) {
      const oIdx  = outNames.indexOf(originStopName);
      const hIdx  = outNames.indexOf('City Terminus');
      if (oIdx < hIdx) {
        const stops = hIdx - oIdx;
        toHub.push({
          routeId, routeName: routeData.name, color: routeData.color,
          stopsBetween: stops,
          fare: routeData.baseFare + (stops - 1) * routeData.farePerStop,
        });
      }
    }

    if (outNames.includes('City Terminus') && outNames.includes(destStopName)) {
      const hIdx  = outNames.indexOf('City Terminus');
      const dIdx  = outNames.indexOf(destStopName);
      if (hIdx < dIdx) {
        const stops = dIdx - hIdx;
        fromHub.push({
          routeId, routeName: routeData.name, color: routeData.color,
          stopsBetween: stops,
          fare: routeData.baseFare + (stops - 1) * routeData.farePerStop,
        });
      }
    }
  }

  for (const first of toHub) {
    for (const second of fromHub) {
      if (first.routeId !== second.routeId) {
        results.push({
          type:         'transfer',
          firstRoute:   first.routeName,
          secondRoute:  second.routeName,
          firstRouteId: first.routeId,
          secondRouteId:second.routeId,
          firstColor:   first.color,
          secondColor:  second.color,
          originStop:   originStopName,
          destStop:     destStopName,
          transferStop: 'City Terminus',
          totalStops:   first.stopsBetween + second.stopsBetween,
          totalFare:    first.fare + second.fare,
        });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLE — next arrival
// ─────────────────────────────────────────────────────────────────────────────

export function getNextArrival(routeId, direction, stopName, currentTime = new Date()) {
  const route = ROUTES[routeId];
  if (!route) return null;

  const day = currentTime.getDay();
  const key = day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
  const timetable = route.timetable[key][direction];
  if (!timetable) return null;

  const cur = currentTime.getHours() * 60 + currentTime.getMinutes();

  for (const t of timetable) {
    const [h, m] = t.split(':').map(Number);
    const bm     = h * 60 + m;
    if (bm > cur) return { time: t, minutesAway: bm - cur };
  }

  return { time: timetable[0], minutesAway: null }; // wrap to tomorrow's first bus
}

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENTS
// ─────────────────────────────────────────────────────────────────────────────

export function listenToIncidents(routeId, callback) {
  return onSnapshot(collection(db, 'incidents'), (snap) => {
    try {
      const all    = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const active = all.filter(i => i.routeId === routeId && i.status === 'ACTIVE');
      callback(active);
    } catch (e) {
      console.error('Incident listener error:', e);
      callback([]);
    }
  });
}