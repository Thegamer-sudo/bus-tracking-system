// src/services/aiService.js
// Session 1 update — predictDelay now incorporates real-time simulated traffic
// from trafficService.js for richer, more useful predictions.
// All existing functions are preserved.

import { db } from '../config/firebase';
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { getTotalRouteDelay, getTrafficSummary } from './trafficService';

// ─────────────────────────────────────────────────────────────────────────────
// RECORD — write a delay observation when the bus arrives at a stop
// (called from DriverDashboard simulation loop)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record an actual delay observation when a bus arrives at a stop.
 * @param {string}   stopId
 * @param {string}   routeId
 * @param {Date}     scheduledTime
 * @param {Date}     actualTime
 * @param {string[]} incidentIds
 */
export async function recordDelayObservation(stopId, routeId, scheduledTime, actualTime, incidentIds = []) {
  const delayMinutes = (actualTime - scheduledTime) / (1000 * 60);
  if (delayMinutes <= 0) return;

  try {
    await addDoc(collection(db, 'delay_history'), {
      stopId,
      routeId,
      hour:          scheduledTime.getHours(),
      dayOfWeek:     scheduledTime.getDay(),
      delayMinutes:  Math.round(delayMinutes),
      incidentIds,
      timestamp:     serverTimestamp(),
    });
    console.log(`✅ Delay recorded: ${delayMinutes.toFixed(1)}min at ${stopId}`);
  } catch (e) {
    console.error('Failed to record delay:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICT — k-NN from delay_history + traffic overlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Predict delay for a given stop using historical k-NN + current traffic.
 *
 * Returns an enriched object used by JourneyPlannerScreen to display a badge.
 *
 * @param {string}   stopId
 * @param {string}   routeId
 * @param {Date}     [targetTime]
 * @param {string[]} [activeIncidentIds]
 * @returns {Promise<{
 *   delayMinutes:   number,
 *   label:          string,
 *   color:          string,
 *   confidence:     'high'|'medium'|'low',
 *   trafficSummary: { label:string, color:string, totalDelay:number },
 * }>}
 */
export async function predictDelay(
  stopId,
  routeId,
  targetTime = new Date(),
  activeIncidentIds = [],
) {
  // 1. Get the traffic-based delay estimate (always available — no Firestore needed)
  const trafficDelay   = getTotalRouteDelay(routeId, targetTime);
  const trafficSummary = getTrafficSummary(routeId, targetTime);

  // 2. Try the k-NN historical model
  let historicalDelay = 0;
  let confidence      = 'low';

  try {
    const q = query(
      collection(db, 'delay_history'),
      where('stopId',  '==', stopId),
      where('routeId', '==', routeId),
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const records      = snap.docs.map(d => d.data());
      const targetHour   = targetTime.getHours();
      const targetDay    = targetTime.getDay();
      const targetHasInc = activeIncidentIds.length > 0 ? 1 : 0;

      const K = Math.min(5, records.length);

      const distances = records.map(rec => {
        const hourDiff = Math.abs(rec.hour - targetHour) / 12;
        const dayDiff  = Math.abs(rec.dayOfWeek - targetDay) / 6;
        const incDiff  = Math.abs((rec.incidentIds?.length > 0 ? 1 : 0) - targetHasInc);
        const dist     = Math.sqrt(hourDiff ** 2 + dayDiff ** 2 + incDiff ** 2);
        return { delay: rec.delayMinutes, distance: dist };
      });

      distances.sort((a, b) => a.distance - b.distance);
      const neighbors    = distances.slice(0, K);
      historicalDelay    = Math.round(neighbors.reduce((s, n) => s + n.delay, 0) / K);
      confidence         = records.length >= 10 ? 'high' : records.length >= 4 ? 'medium' : 'low';
    }
  } catch (e) {
    console.warn('k-NN prediction failed, using traffic only:', e.message);
  }

  // 3. Combine: weight historical 60%, traffic 40%
  const combined = confidence === 'low'
    ? trafficDelay                                            // no history — use traffic only
    : Math.round(historicalDelay * 0.6 + trafficDelay * 0.4);

  // 4. Build the badge label + colour
  let label, color;
  if (combined <= 2) {
    label = 'On time';     color = '#00A86B';
  } else if (combined <= 8) {
    label = `~${combined} min delay`;  color = '#F5A623';
  } else {
    label = `High delay (~${combined} min)`;  color = '#E53935';
  }

  return {
    delayMinutes:   combined,
    label,
    color,
    confidence,
    trafficSummary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED — generate realistic delay history for demonstration
// Call once from a debug button in HomeScreen
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDelayData() {
  const stops = [
    'Woodlands Circle','Radcliffe Road','Kenyon Howden Road','Umbilo Road',
    'Glenwood','Musgrave Centre','Berea Road','West Street','Pine Street','City Terminus',
  ];

  for (const stop of stops) {
    for (let hour = 5; hour <= 20; hour++) {
      let delay = 0;
      if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
        delay = 5 + Math.floor(Math.random() * 12); // peak: 5–17 min
      } else if (hour >= 10 && hour <= 15) {
        delay = Math.floor(Math.random() * 5);       // off-peak: 0–4 min
      } else {
        delay = Math.floor(Math.random() * 3);       // early/late: 0–2 min
      }
      if (delay > 0) {
        await addDoc(collection(db, 'delay_history'), {
          stopId:       stop,
          routeId:      'route_520',
          hour,
          dayOfWeek:    2,
          delayMinutes: delay,
          incidentIds:  [],
          timestamp:    serverTimestamp(),
        });
      }
    }
  }
  console.log('✅ Delay data seeded for Route 520');
}

// ─────────────────────────────────────────────────────────────────────────────
// STUB — kept to avoid breaking any screens that import it
// ─────────────────────────────────────────────────────────────────────────────

export async function runAIDiversion() {
  console.log('[AI] Diversion feature is disabled');
  return null;
}

export async function recordActualDelay() {}