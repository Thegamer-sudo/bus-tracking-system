// src/services/trafficService.js
//
// Simulated traffic engine for BusTrack.
// Reads TRAFFIC_SEGMENTS from constants.js and the current hour to produce
// a list of active congestion zones, their severity, and the map polyline
// coordinates needed to draw colour-coded overlays on the driver's map.
//
// No real-time data or API key is needed — all logic is deterministic based
// on time of day, with a small random fluctuation so the UI feels alive.

import { TRAFFIC_SEGMENTS, COLORS, ROUTES } from '../config/constants';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES (JSDoc for IDE hints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TrafficZone
 * @property {number}   fromStopIndex
 * @property {number}   toStopIndex
 * @property {string}   label              - Human-readable segment name
 * @property {'clear'|'moderate'|'heavy'} severity
 * @property {string}   color              - Hex colour for map polyline
 * @property {number}   extraDelayMinutes  - Estimated added delay for this segment
 * @property {boolean}  isPeak             - True when currently in a peak hour
 * @property {{ latitude:number, longitude:number }[]} coords
 *   Two-point straight line between the two stops (OSRM road coords are
 *   supplied separately by routeService; we just mark the segment here).
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a severity string to a COLORS value and a display label.
 */
function severityMeta(severity) {
  switch (severity) {
    case 'heavy':
      return { color: COLORS.trafficHeavy, displayLabel: 'Heavy', delayMultiplier: 1.0 };
    case 'moderate':
      return { color: COLORS.trafficModerate, displayLabel: 'Moderate', delayMultiplier: 0.5 };
    default:
      return { color: COLORS.trafficClear, displayLabel: 'Clear', delayMultiplier: 0 };
  }
}

/**
 * Add a small random jitter (±1 unit) so traffic feels dynamic across renders.
 * We seed with the current minute so it changes naturally every 60 seconds.
 */
function jitter(value) {
  const seed = new Date().getMinutes();
  const noise = ((seed * 9301 + 49297) % 233280) / 233280; // cheap LCG
  return value + Math.round((noise - 0.5) * 2);             // ±1 minute
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: getCurrentTraffic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current simulated traffic state for a route.
 *
 * @param {string} routeId   - e.g. 'route_520'
 * @param {Date}   [now]     - Defaults to new Date(). Pass a custom Date for testing.
 * @returns {TrafficZone[]}  - One entry per defined segment; severity may be 'clear'
 *                            outside peak hours.
 */
export function getCurrentTraffic(routeId, now = new Date()) {
  const segments = TRAFFIC_SEGMENTS[routeId];
  if (!segments || segments.length === 0) return [];

  const route    = ROUTES[routeId];
  const stops    = route ? route.outboundStops : [];
  const hour     = now.getHours();

  return segments.map((seg) => {
    const isPeak   = seg.peakHours.includes(hour);
    const severity = isPeak ? seg.baseSeverity : 'clear';
    const meta     = severityMeta(severity);

    const fromStop = stops[seg.fromStopIndex];
    const toStop   = stops[seg.toStopIndex];

    // Two-point coordinate pair so callers can draw a Polyline marker
    const coords = fromStop && toStop
      ? [
          { latitude: fromStop.latitude, longitude: fromStop.longitude },
          { latitude: toStop.latitude,   longitude: toStop.longitude   },
        ]
      : [];

    const baseDelay  = isPeak ? seg.extraDelayMinutes : 0;
    const finalDelay = isPeak ? Math.max(0, jitter(baseDelay)) : 0;

    return {
      fromStopIndex:      seg.fromStopIndex,
      toStopIndex:        seg.toStopIndex,
      label:              seg.label,
      severity,
      color:              meta.color,
      displayLabel:       meta.displayLabel,
      extraDelayMinutes:  finalDelay,
      isPeak,
      coords,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: getActiveHeavySegments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters the traffic list to only heavy-severity segments.
 * Used by DriverDashboard to decide whether to show the "report a delay?" banner.
 *
 * @param {string} routeId
 * @param {Date}   [now]
 * @returns {TrafficZone[]}
 */
export function getActiveHeavySegments(routeId, now = new Date()) {
  return getCurrentTraffic(routeId, now).filter(z => z.severity === 'heavy');
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: isDriverInTraffic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the heaviest traffic zone the bus is currently travelling through,
 * or null if the road ahead is clear.
 *
 * @param {string} routeId
 * @param {number} currentStopIndex  - The bus's current stop index
 * @param {Date}   [now]
 * @returns {TrafficZone|null}
 */
export function isDriverInTraffic(routeId, currentStopIndex, now = new Date()) {
  const zones = getCurrentTraffic(routeId, now);

  // A zone is "active" for the driver if the bus is at or just before its start
  const ahead = zones.filter(
    z => z.severity !== 'clear' &&
         z.fromStopIndex >= currentStopIndex &&
         z.fromStopIndex <= currentStopIndex + 1
  );

  if (ahead.length === 0) return null;

  // Return the most severe zone
  return ahead.sort((a, b) => {
    const order = { heavy: 2, moderate: 1, clear: 0 };
    return order[b.severity] - order[a.severity];
  })[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: getTotalRouteDelay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sums up all expected delay minutes across the whole route right now.
 * Used by the AI prediction badge in JourneyPlannerScreen.
 *
 * @param {string} routeId
 * @param {Date}   [now]
 * @returns {number} total estimated delay in minutes
 */
export function getTotalRouteDelay(routeId, now = new Date()) {
  return getCurrentTraffic(routeId, now)
    .reduce((sum, z) => sum + z.extraDelayMinutes, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: getTrafficSummary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a one-line human-readable summary of current traffic on a route.
 * Shown in the user's journey planner route card.
 *
 * @param {string} routeId
 * @param {Date}   [now]
 * @returns {{ label: string, color: string, totalDelay: number }}
 */
export function getTrafficSummary(routeId, now = new Date()) {
  const zones       = getCurrentTraffic(routeId, now);
  const totalDelay  = zones.reduce((s, z) => s + z.extraDelayMinutes, 0);
  const heavyCount  = zones.filter(z => z.severity === 'heavy').length;
  const modCount    = zones.filter(z => z.severity === 'moderate').length;

  if (heavyCount > 0) {
    return {
      label:      `Heavy traffic — ~${totalDelay} min delay`,
      color:      COLORS.trafficHeavy,
      totalDelay,
    };
  }
  if (modCount > 0) {
    return {
      label:      `Moderate traffic — ~${totalDelay} min delay`,
      color:      COLORS.trafficModerate,
      totalDelay,
    };
  }
  return {
    label:      'Roads clear',
    color:      COLORS.trafficClear,
    totalDelay: 0,
  };
}