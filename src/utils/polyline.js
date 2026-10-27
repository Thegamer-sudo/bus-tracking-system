// src/services/aiService.js
import { decodePolyline } from '../utils/polyline';
import { ROUTE_520_STOPS, ROUTE_520_STOPS_REVERSE, INCIDENT_TYPES } from '../config/constants';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

// ── Helper: OSRM route call (free, no API key) ──
export const fetchOSRMRoute = async (waypoints) => {
  // waypoints: array of {lat, lng}
  const coordsStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
  const url = `http://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=polyline`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok') return data.routes;
  } catch (e) {
    console.error('OSRM error:', e);
  }
  return [];
};

// ── Generate bypass candidates for a blocked segment ──
export const generateBypassCandidates = async (blockedStop, stopBefore, stopAfter) => {
  const candidates = [];
  const offsets = [
    { strategy: 'skip_blocked', dlat: null, dlng: null, skipped: [blockedStop] },
    { strategy: 'bypass_north', dlat: -0.008, dlng: 0, skipped: [] },
    { strategy: 'bypass_west',  dlat: 0, dlng: -0.012, skipped: [] },
    { strategy: 'bypass_south', dlat: 0.008, dlng: 0, skipped: [] },
    { strategy: 'bypass_nw',    dlat: -0.006, dlng: -0.008, skipped: [] },
  ];

  const origRoutes = await fetchOSRMRoute([stopBefore, blockedStop]);
  const origDist = origRoutes[0]?.distance || 0;

  for (const off of offsets) {
    let waypoints;
    if (off.strategy === 'skip_blocked') {
      waypoints = [stopBefore, stopAfter];
    } else {
      const mid = { lat: blockedStop.lat + off.dlat, lng: blockedStop.lng + off.dlng };
      waypoints = [stopBefore, mid, blockedStop];
    }
    const routes = await fetchOSRMRoute(waypoints);
    if (routes && routes.length > 0) {
      const coords = decodePolyline(routes[0].geometry);
      const detour = (routes[0].distance - origDist) / 1000;
      candidates.push({
        strategy: off.strategy,
        coords,
        stopsSkipped: off.skipped.map(s => s.name),
        detourKm: Math.round(detour * 100) / 100,
        durationSec: routes[0].duration,
        roadPoints: coords.length,
      });
    }
    await new Promise(r => setTimeout(r, 100)); // polite delay
  }
  return candidates;
};

// ── Score a candidate with congestion, peak hour, and historical memory ──
export const scoreCandidate = async (candidate, segmentKey, incidentType, hour) => {
  const skippedCount = candidate.stopsSkipped.length;
  const detour = candidate.detourKm;
  const baseDelayMin = candidate.durationSec / 60;

  // Incident severity multiplier
  const severityMap = { 1: 1.1, 2: 1.3, 3: 1.6 };
  const severity = INCIDENT_TYPES[incidentType]?.severity || 2;
  const severityMult = severityMap[severity] || 1.3;

  // Peak hour penalty
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
  const peakMult = isPeak ? 1.25 : 1.0;

  // Spillover delay on alternative roads
  const spillover = Math.max(0, detour * 0.8);

  const totalDelayMin = (baseDelayMin * severityMult * peakMult) + spillover;

  // Component scores
  const stopsScore = Math.max(0, 40 - skippedCount * 35);
  const detourScore = Math.max(0, 25 - detour * 5);
  const delayScore = Math.max(0, 20 - totalDelayMin * 0.8);
  const densityScore = Math.min(10, candidate.roadPoints / 30);
  const peakPenalty = (isPeak && detour > 2) ? -5 : 0;

  // Historical memory from Firestore
  const memRef = doc(db, 'ai_memory', `${segmentKey}_${candidate.strategy}`);
  const memSnap = await getDoc(memRef);
  let memoryAdj = 0;
  if (memSnap.exists()) {
    const outcomes = memSnap.data().outcomes || [];
    const recent = outcomes.slice(-5);
    const avgExtra = recent.reduce((s, o) => s + o.actualExtraMin, 0) / (recent.length || 1);
    memoryAdj = Math.max(-10, 10 - avgExtra);
  }

  let total = stopsScore + detourScore + delayScore + densityScore + peakPenalty + memoryAdj;
  total = Math.min(100, Math.max(0, total));

  return {
    total: Math.round(total * 10) / 10,
    delayMin: Math.round(totalDelayMin * 10) / 10,
    breakdown: {
      stopsPreserved: stopsScore,
      detour: detourScore,
      congestionDelay: delayScore,
      roadQuality: densityScore,
      peakPenalty,
      memoryAdjust: memoryAdj,
    },
  };
};

// Cache for original segment coordinates (precompute once)
let segmentCache = { outbound: [], inbound: [] };

export const precomputeOriginalSegments = async () => {
  // Outbound
  segmentCache.outbound = [];
  for (let i = 0; i < ROUTE_520_STOPS.length - 1; i++) {
    const a = ROUTE_520_STOPS[i];
    const b = ROUTE_520_STOPS[i+1];
    const routes = await fetchOSRMRoute([{ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude }]);
    if (routes.length) {
      segmentCache.outbound.push(decodePolyline(routes[0].geometry));
    } else {
      // fallback straight line
      segmentCache.outbound.push([{ latitude: a.latitude, longitude: a.longitude }, { latitude: b.latitude, longitude: b.longitude }]);
    }
  }
  // Inbound
  segmentCache.inbound = [];
  for (let i = 0; i < ROUTE_520_STOPS_REVERSE.length - 1; i++) {
    const a = ROUTE_520_STOPS_REVERSE[i];
    const b = ROUTE_520_STOPS_REVERSE[i+1];
    const routes = await fetchOSRMRoute([{ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude }]);
    if (routes.length) {
      segmentCache.inbound.push(decodePolyline(routes[0].geometry));
    } else {
      segmentCache.inbound.push([{ latitude: a.latitude, longitude: a.longitude }, { latitude: b.latitude, longitude: b.longitude }]);
    }
  }
};

export const getOriginalSegmentCoords = (stops, idx) => {
  const direction = stops === ROUTE_520_STOPS ? 'outbound' : 'inbound';
  return segmentCache[direction][idx];
};

// ── Main AI diversion: replace only the blocked segment ──
export const runDiversion = async (direction, incidentStopIdx, incidentType, hour, busStopIdx) => {
  const stops = direction === 'outbound' ? ROUTE_520_STOPS : ROUTE_520_STOPS_REVERSE;
  if (incidentStopIdx < 1 || incidentStopIdx >= stops.length - 1) return null;

  const segIdx = incidentStopIdx - 1;
  const blockedStop = stops[incidentStopIdx];
  const stopBefore = stops[segIdx];
  const stopAfter = stops[incidentStopIdx + 1];
  const segmentKey = `${direction}_seg_${segIdx}`;

  // Convert to format expected by generateBypassCandidates: {lat, lng}
  const blockedStopLatLng = { lat: blockedStop.latitude, lng: blockedStop.longitude };
  const stopBeforeLatLng = { lat: stopBefore.latitude, lng: stopBefore.longitude };
  const stopAfterLatLng = { lat: stopAfter.latitude, lng: stopAfter.longitude };

  const candidates = await generateBypassCandidates(blockedStopLatLng, stopBeforeLatLng, stopAfterLatLng);
  if (!candidates.length) return null;

  // Score each candidate
  const scored = [];
  for (const cand of candidates) {
    const score = await scoreCandidate(cand, segmentKey, incidentType, hour);
    scored.push({ ...cand, ...score });
  }
  scored.sort((a, b) => b.total - a.total);
  const best = scored[0];

  // Build full route using cached original segments
  const fullRoute = [];
  const segmentLog = [];
  for (let i = 0; i < stops.length - 1; i++) {
    let segCoords;
    let type;
    if (i === segIdx) {
      segCoords = best.coords;
      type = 'DIVERTED';
    } else {
      segCoords = getOriginalSegmentCoords(stops, i);
      type = 'ORIGINAL';
    }
    segmentLog.push({
      segment: `${stops[i].name} → ${stops[i+1].name}`,
      type,
      roadPoints: segCoords.length,
    });
    if (i === 0) fullRoute.push(...segCoords);
    else fullRoute.push(...segCoords.slice(1));
  }

  // Record incident in Firestore
  const incidentRecord = {
    id: `INC_${Date.now()}`,
    direction,
    incidentType,
    incidentStop: blockedStop,
    blockedStopIdx: incidentStopIdx,
    busStopIdx,
    hour,
    bestStrategy: best.strategy,
    score: best.total,
    delayMin: best.delayMin,
    stopsSkipped: best.stopsSkipped,
    detourKm: best.detourKm,
    segmentKey,
    timestamp: new Date().toISOString(),
    feedbackGiven: false,
    actualExtraMin: null,
  };
  const incidentRef = doc(db, 'incidents', incidentRecord.id);
  await setDoc(incidentRef, incidentRecord);

  return {
    decision: best,
    fullRoute,
    segmentLog,
    stops,
    incidentRecord,
  };
};

// Optional: record outcome after passenger feedback
export const recordOutcome = async (segmentKey, strategy, actualExtraMin, hour) => {
  const memKey = `${segmentKey}_${strategy}`;
  const memRef = doc(db, 'ai_memory', memKey);
  const memSnap = await getDoc(memRef);
  if (memSnap.exists()) {
    await updateDoc(memRef, {
      outcomes: arrayUnion({ actualExtraMin, hour, timestamp: new Date().toISOString() }),
    });
  } else {
    await setDoc(memRef, {
      outcomes: [{ actualExtraMin, hour, timestamp: new Date().toISOString() }],
    });
  }
};