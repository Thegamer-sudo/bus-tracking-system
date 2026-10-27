// src/services/offlineService.js
//
// Offline support layer for BusTrack.
//
// Strategy: cache-first, network-second.
// On first run (or when online) we write route data, timetables, and bus
// positions to AsyncStorage. When the device is offline, screens read from
// the cache so core features still work without data.
//
// What works offline:
//   ✅ Journey Planner     — uses cached stop lists + timetable ETAs
//   ✅ Stop Locator        — GPS still works; cached stops used for distances
//   ✅ Fare Calculator     — fully local math, no cache needed
//   ✅ Timetable display   — cached
//   ⚠️  Live Tracking      — shows last cached bus position + offline banner
//   ❌  Real-time Firestore — requires connectivity
//
// Install dep: npx expo install @react-native-async-storage/async-storage
//              npx expo install @react-native-community/netinfo

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { ROUTES } from '../config/constants';

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE KEYS  (keep as constants so typos don't cause silent failures)
// ─────────────────────────────────────────────────────────────────────────────

const KEYS = {
  ROUTE_DATA:       'bustrack:route_data',
  BUS_PREFIX:       'bustrack:bus:',      // + busId
  USER_PREFS:       'bustrack:user_prefs',
  DRIVER_PREFS:     'bustrack:driver_prefs',
  LAST_CACHED_AT:   'bustrack:cached_at',
  NOTIFICATIONS:    'bustrack:notifications',
};

// Maximum age of bus-position cache before we show "possibly outdated"
const BUS_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIVITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the device currently has internet access.
 * Always await this before attempting Firestore calls.
 */
export async function isOnline() {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable !== false;
  } catch {
    return false;
  }
}

/**
 * Subscribe to connectivity changes.
 * @param {(online: boolean) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function onConnectivityChange(callback) {
  return NetInfo.addEventListener((state) => {
    callback(state.isConnected && state.isInternetReachable !== false);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DATA  (stops + timetables from constants — static, rarely changes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write the full ROUTES object from constants.js into AsyncStorage.
 * Call this on every app start when online so the cache stays fresh.
 */
export async function cacheRouteData() {
  try {
    await AsyncStorage.setItem(KEYS.ROUTE_DATA, JSON.stringify(ROUTES));
    await AsyncStorage.setItem(KEYS.LAST_CACHED_AT, new Date().toISOString());
    console.log('[Offline] Route data cached ✅');
  } catch (e) {
    console.warn('[Offline] Failed to cache route data:', e.message);
  }
}

/**
 * Read the cached ROUTES object.
 * Falls back to the imported ROUTES constant if the cache is empty —
 * since ROUTES is static this is always a valid fallback.
 *
 * @returns {Promise<typeof ROUTES>}
 */
export async function getCachedRouteData() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ROUTE_DATA);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[Offline] Failed to read route cache:', e.message);
  }
  // Fallback: return the compile-time constant (always available)
  return ROUTES;
}

/**
 * Returns an ISO string of when the route data was last cached, or null.
 */
export async function getLastCachedAt() {
  try {
    return await AsyncStorage.getItem(KEYS.LAST_CACHED_AT);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUS POSITIONS  (written every time listenToBus() fires)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache the latest bus position received from Firestore.
 * Call this inside the listenToBus() callback in routeService.
 *
 * @param {string} busId   - e.g. 'bus_520_001'
 * @param {object} data    - The bus Firestore document data
 */
export async function cacheLastBusPosition(busId, data) {
  try {
    const payload = { ...data, _cachedAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEYS.BUS_PREFIX + busId, JSON.stringify(payload));
  } catch (e) {
    console.warn('[Offline] Failed to cache bus position:', e.message);
  }
}

/**
 * Retrieve the last known bus position from cache.
 *
 * @param {string} busId
 * @returns {Promise<{ data: object|null, isStale: boolean }>}
 *   data     — the cached bus doc, or null if never cached
 *   isStale  — true if the cache is older than BUS_CACHE_MAX_AGE_MS
 */
export async function getCachedBusPosition(busId) {
  try {
    const raw = await AsyncStorage.getItem(KEYS.BUS_PREFIX + busId);
    if (!raw) return { data: null, isStale: true };

    const parsed  = JSON.parse(raw);
    const cachedAt = parsed._cachedAt ? new Date(parsed._cachedAt) : null;
    const age      = cachedAt ? Date.now() - cachedAt.getTime() : Infinity;

    return {
      data:    parsed,
      isStale: age > BUS_CACHE_MAX_AGE_MS,
    };
  } catch (e) {
    console.warn('[Offline] Failed to read bus cache:', e.message);
    return { data: null, isStale: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PREFERENCES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save user preferences locally (mirrors what is also saved to Firestore).
 * Used as an instant-read source so settings screens load without Firestore lag.
 *
 * @param {object} prefs
 */
export async function saveUserPrefsLocally(prefs) {
  try {
    await AsyncStorage.setItem(KEYS.USER_PREFS, JSON.stringify(prefs));
  } catch (e) {
    console.warn('[Offline] Failed to save user prefs locally:', e.message);
  }
}

/**
 * Read locally-cached user preferences.
 * @returns {Promise<object|null>}
 */
export async function getLocalUserPrefs() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER_PREFS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save driver preferences locally.
 * @param {object} prefs
 */
export async function saveDriverPrefsLocally(prefs) {
  try {
    await AsyncStorage.setItem(KEYS.DRIVER_PREFS, JSON.stringify(prefs));
  } catch (e) {
    console.warn('[Offline] Failed to save driver prefs locally:', e.message);
  }
}

/**
 * Read locally-cached driver preferences.
 * @returns {Promise<object|null>}
 */
export async function getLocalDriverPrefs() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DRIVER_PREFS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION LOG  (local history so NotificationsScreen works offline)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append a notification entry to the local log.
 * Keeps only the 50 most recent entries to avoid unbounded storage.
 *
 * @param {{ title: string, body: string, type: string }} notification
 */
export async function logNotificationLocally(notification) {
  try {
    const raw      = await AsyncStorage.getItem(KEYS.NOTIFICATIONS);
    const existing = raw ? JSON.parse(raw) : [];
    const entry    = { ...notification, timestamp: new Date().toISOString() };
    const updated  = [entry, ...existing].slice(0, 50);
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
  } catch (e) {
    console.warn('[Offline] Failed to log notification:', e.message);
  }
}

/**
 * Read the local notification log.
 * @returns {Promise<object[]>}
 */
export async function getLocalNotifications() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFICATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clear the local notification log.
 */
export async function clearLocalNotifications() {
  try {
    await AsyncStorage.removeItem(KEYS.NOTIFICATIONS);
  } catch (e) {
    console.warn('[Offline] Failed to clear notifications:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISATION — call once from App.js on startup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs all caching tasks needed at startup.
 * Safe to call regardless of connectivity — it checks isOnline() internally.
 * Always resolves (never throws) so it cannot block app launch.
 */
export async function initOfflineCache() {
  try {
    const online = await isOnline();
    if (online) {
      await cacheRouteData();
      console.log('[Offline] Cache initialised — device is online ✅');
    } else {
      console.log('[Offline] Device is offline — serving from cache ⚠️');
    }
  } catch (e) {
    console.warn('[Offline] initOfflineCache error (non-fatal):', e.message);
  }
}