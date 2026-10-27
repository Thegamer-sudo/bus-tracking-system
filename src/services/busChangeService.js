// src/services/busChangeService.js
//
// Handles bus reassignment events — when a bus on a route is swapped out
// (e.g. breakdown, maintenance) and passengers need to be notified of the
// new bus number and where to board.
//
// Firestore collection: bus_changes/{auto-id}
//
// Schema:
//   routeId          string   — 'route_520' | 'route_525' | 'route_530'
//   oldBusId         string   — Firestore bus document ID, e.g. 'bus_520_001'
//   newBusId         string   — new bus document ID
//   oldBusLabel      string   — human-readable, e.g. 'BT-520'
//   newBusLabel      string   — e.g. 'BT-520B'
//   reason           string   — key from BUS_CHANGE_REASONS
//   reasonLabel      string   — human-readable reason label
//   boardingStop     string   — stop name where passengers should reboard
//   boardingStopIdx  number   — stop index
//   createdBy        string   — uid of driver or admin who logged it
//   createdByName    string   — display name
//   isActive         boolean  — true until resolved/expired
//   timestamp        Timestamp
//   resolvedAt       Timestamp | null

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendLocalNotification } from './notificationService';
import { logNotificationLocally } from './offlineService';
import { BUS_CHANGE_REASONS } from '../config/constants';

const COLLECTION = 'bus_changes';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a new bus change event and notify passengers.
 *
 * @param {object} params
 * @param {string} params.routeId
 * @param {string} params.routeName         - e.g. 'Route 520'
 * @param {string} params.oldBusId
 * @param {string} params.newBusId
 * @param {string} params.oldBusLabel       - e.g. 'BT-520'
 * @param {string} params.newBusLabel       - e.g. 'BT-520B'
 * @param {string} params.reasonKey         - key from BUS_CHANGE_REASONS
 * @param {string} params.boardingStop      - stop name
 * @param {number} params.boardingStopIdx
 * @param {string} params.createdBy         - uid
 * @param {string} params.createdByName
 * @returns {Promise<string>} The new Firestore document ID
 */
export async function logBusChange({
  routeId,
  routeName,
  oldBusId,
  newBusId,
  oldBusLabel,
  newBusLabel,
  reasonKey,
  boardingStop,
  boardingStopIdx,
  createdBy,
  createdByName,
}) {
  const reasonObj  = BUS_CHANGE_REASONS.find(r => r.key === reasonKey) || { label: reasonKey };
  const reasonLabel = reasonObj.label;

  const payload = {
    routeId,
    routeName,
    oldBusId,
    newBusId,
    oldBusLabel,
    newBusLabel,
    reason:          reasonKey,
    reasonLabel,
    boardingStop,
    boardingStopIdx: boardingStopIdx ?? 0,
    createdBy:       createdBy || 'unknown',
    createdByName:   createdByName || 'Driver',
    isActive:        true,
    timestamp:       serverTimestamp(),
    resolvedAt:      null,
  };

  const ref   = await addDoc(collection(db, COLLECTION), payload);
  const docId = ref.id;

  // Fire a local push notification so users currently in the app see it
  const notifTitle = `${routeName} — Bus Change`;
  const notifBody  = `${newBusLabel} is replacing ${oldBusLabel}. Board at ${boardingStop}.`;
  await sendLocalNotification(notifTitle, notifBody);

  // Also log to local storage so NotificationsScreen can show it offline
  await logNotificationLocally({
    title:   notifTitle,
    body:    notifBody,
    type:    'BUS_CHANGE',
    routeId,
    docId,
  });

  console.log(`[BusChange] Logged change for ${routeName}: ${oldBusLabel} → ${newBusLabel}`);
  return docId;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a bus change event as resolved (e.g. original bus is back in service).
 * @param {string} docId - The bus_changes document ID
 */
export async function resolveBusChange(docId) {
  try {
    await updateDoc(doc(db, COLLECTION, docId), {
      isActive:   false,
      resolvedAt: serverTimestamp(),
    });
    console.log(`[BusChange] Resolved: ${docId}`);
  } catch (e) {
    console.error('[BusChange] Failed to resolve:', e.message);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTEN — active changes for a specific route (user-facing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to active bus change events for a route.
 * Used by HomeScreen and LiveTrackingScreen to show the alert banner.
 *
 * @param {string}   routeId
 * @param {Function} callback  - Receives array of active change docs
 * @returns {Function}         - Unsubscribe function
 */
export function listenToActiveBusChanges(routeId, callback) {
  const q = query(
    collection(db, COLLECTION),
    where('routeId', '==', routeId),
    where('isActive', '==', true),
    orderBy('timestamp', 'desc'),
    limit(5),
  );

  return onSnapshot(q, (snap) => {
    const changes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(changes);
  }, (err) => {
    console.warn('[BusChange] Listener error:', err.message);
    callback([]);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTEN — all changes (admin-facing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to all bus change events across all routes (admin view).
 * Returns the 30 most recent events, both active and resolved.
 *
 * @param {Function} callback - Receives array of change docs
 * @returns {Function}        - Unsubscribe function
 */
export function listenToAllBusChanges(callback) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(30),
  );

  return onSnapshot(q, (snap) => {
    const changes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(changes);
  }, (err) => {
    console.warn('[BusChange] Admin listener error:', err.message);
    callback([]);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET LATEST ACTIVE CHANGE — one-shot fetch (used in offline-aware screens)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-time fetch of the latest active bus change for a route.
 * Use this when a real-time listener is not practical.
 *
 * @param {string} routeId
 * @returns {Promise<object|null>}
 */
export async function getActiveChangeForRoute(routeId) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('routeId', '==', routeId),
      where('isActive', '==', true),
      orderBy('timestamp', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  } catch (e) {
    console.warn('[BusChange] Fetch error:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the user-facing banner text for an active bus change.
 * Used consistently across HomeScreen and LiveTrackingScreen.
 *
 * @param {object} change - A bus_changes Firestore document
 * @returns {string}
 */
export function getBusChangeBannerText(change) {
  if (!change) return '';
  return `⚡ Bus changed to ${change.newBusLabel} — board at ${change.boardingStop}`;
}

/**
 * Format a bus change for the admin list view.
 * @param {object} change
 * @returns {{ title: string, subtitle: string, timeAgo: string }}
 */
export function formatBusChangeForList(change) {
  const title    = `${change.routeName}: ${change.oldBusLabel} → ${change.newBusLabel}`;
  const subtitle = `${change.reasonLabel} · Board at ${change.boardingStop}`;

  let timeAgo = '';
  if (change.timestamp?.toDate) {
    const ms      = Date.now() - change.timestamp.toDate().getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1)       timeAgo = 'Just now';
    else if (minutes < 60) timeAgo = `${minutes}m ago`;
    else                   timeAgo = `${Math.floor(minutes / 60)}h ago`;
  }

  return { title, subtitle, timeAgo };
}