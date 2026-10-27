// src/components/debug/NotificationDebugPanel.js
//
// DROP THIS INTO HomeScreen temporarily to find exactly where notifications break.
// Add it just above the map:
//
//   import NotificationDebugPanel from '../../components/debug/NotificationDebugPanel';
//   // then inside the JSX, above <View style={styles.mapContainer}>:
//   <NotificationDebugPanel />
//
// Each row shows ✅ (working) ❌ (broken) ⏳ (checking).
// Share a screenshot of this panel and we'll know exactly what to fix.
// REMOVE THIS FILE before final submission.

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const Row = ({ label, status, detail }) => {
  const icon = status === 'ok' ? '✅' : status === 'fail' ? '❌' : status === 'warn' ? '⚠️' : '⏳';
  const color = status === 'ok' ? '#00A86B' : status === 'fail' ? '#E53935' : status === 'warn' ? '#F5A623' : '#888';
  return (
    <View style={row.wrap}>
      <Text style={row.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[row.label, { color }]}>{label}</Text>
        {!!detail && <Text style={row.detail}>{detail}</Text>}
      </View>
    </View>
  );
};
const row = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#222', gap: 8 },
  icon:   { fontSize: 16, width: 24 },
  label:  { fontSize: 12, fontWeight: '600' },
  detail: { fontSize: 11, color: '#888', marginTop: 2 },
});

export default function NotificationDebugPanel() {
  const [checks, setChecks] = useState([]);
  const [running, setRunning] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const update = (id, status, detail) => {
    setChecks(prev => {
      const existing = prev.find(c => c.id === id);
      if (existing) return prev.map(c => c.id === id ? { ...c, status, detail } : c);
      return [...prev, { id, label: id, status, detail }];
    });
  };

  const runChecks = async () => {
    setRunning(true);
    setChecks([]);

    // ── Check 1: Real device? ──────────────────────────────────────────────
    update('1. Real device', 'checking');
    await sleep(200);
    if (Device.isDevice) {
      update('1. Real device', 'ok', `${Device.brand} ${Device.modelName}`);
    } else {
      update('1. Real device', 'fail', 'Running in emulator/simulator — notifications need a real device');
      setRunning(false);
      return;
    }

    // ── Check 2: Platform ──────────────────────────────────────────────────
    await sleep(200);
    update('2. Platform', 'ok', `${Platform.OS} ${Platform.Version}`);

    // ── Check 3: expo-notifications module loads ───────────────────────────
    update('3. expo-notifications module', 'checking');
    await sleep(200);
    try {
      const keys = Object.keys(Notifications);
      if (keys.includes('scheduleNotificationAsync')) {
        update('3. expo-notifications module', 'ok', `${keys.length} exports found`);
      } else {
        update('3. expo-notifications module', 'fail', 'scheduleNotificationAsync missing');
      }
    } catch (e) {
      update('3. expo-notifications module', 'fail', e.message);
    }

    // ── Check 4: Current permission status ────────────────────────────────
    update('4. Permission status', 'checking');
    await sleep(300);
    try {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        update('4. Permission status', 'ok', 'Granted ✓');
      } else if (status === 'denied' && !canAskAgain) {
        update('4. Permission status', 'fail', 'DENIED — user must go to phone Settings → Apps → Expo Go → Notifications → turn ON');
      } else {
        update('4. Permission status', 'warn', `Status: "${status}" — canAskAgain: ${canAskAgain}`);
      }
    } catch (e) {
      update('4. Permission status', 'fail', e.message);
    }

    // ── Check 5: Request permission (if not granted) ───────────────────────
    update('5. Request permission', 'checking');
    await sleep(300);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        update('5. Request permission', 'ok', 'Permission granted');
      } else {
        update('5. Request permission', 'fail', `Status after request: "${status}"`);
      }
    } catch (e) {
      update('5. Request permission', 'fail', e.message);
    }

    // ── Check 6: Android channel ───────────────────────────────────────────
    if (Platform.OS === 'android') {
      update('6. Android channel', 'checking');
      await sleep(400);
      try {
        await Notifications.setNotificationChannelAsync('bustrack-debug', {
          name:       'BusTrack Debug',
          importance: Notifications.AndroidImportance.MAX,
          sound:      'default',
        });
        const channel = await Notifications.getNotificationChannelAsync('bustrack-debug');
        if (channel) {
          update('6. Android channel', 'ok', `Channel "${channel.id}" importance: ${channel.importance}`);
        } else {
          update('6. Android channel', 'fail', 'Channel created but could not be retrieved');
        }
      } catch (e) {
        update('6. Android channel', 'fail', e.message);
      }
    } else {
      update('6. Android channel', 'ok', 'iOS — no channel needed');
    }

    // ── Check 7: scheduleNotificationAsync ────────────────────────────────
    update('7. Schedule notification', 'checking');
    await sleep(500);
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 BusTrack Debug',
          body:  'Step 7 passed — scheduling works!',
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId: 'bustrack-debug' }),
        },
        trigger: null,
      });
      if (id) {
        update('7. Schedule notification', 'ok', `Notification ID: ${id} — did it appear on your screen?`);
        setTestSent(true);
      } else {
        update('7. Schedule notification', 'fail', 'scheduleNotificationAsync returned no ID');
      }
    } catch (e) {
      update('7. Schedule notification', 'fail', e.message);
    }

    // ── Check 8: getExpoPushTokenAsync (should NOT be called) ────────────
    update('8. Push token check', 'checking');
    await sleep(300);
    // We just verify it exists as a function but intentionally do NOT call it
    if (typeof Notifications.getExpoPushTokenAsync === 'function') {
      update('8. Push token check', 'warn', 'getExpoPushTokenAsync exists — make sure your notificationService.js does NOT call this — it crashes Expo Go SDK 53+');
    } else {
      update('8. Push token check', 'ok', 'Not present in this SDK version (good)');
    }

    // ── Check 9: Notification handler set? ────────────────────────────────
    update('9. Notification handler', 'checking');
    await sleep(200);
    try {
      // setNotificationHandler is synchronous — if it doesn't throw it's set
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge:  false,
        }),
      });
      update('9. Notification handler', 'ok', 'Handler is set — foreground notifications should show');
    } catch (e) {
      update('9. Notification handler', 'fail', e.message);
    }

    setRunning(false);
  };

  return (
    <View style={s.panel}>
      <View style={s.titleRow}>
        <Text style={s.title}>🔍 Notification Debug</Text>
        <TouchableOpacity
          style={[s.btn, running && { opacity: 0.5 }]}
          onPress={runChecks}
          disabled={running}
        >
          <Text style={s.btnText}>{running ? 'Running...' : 'Run checks'}</Text>
        </TouchableOpacity>
      </View>

      {testSent && (
        <View style={s.testBanner}>
          <Text style={s.testBannerText}>
            ↑ A test notification was just scheduled. Did it appear at the top of your screen?{'\n'}
            YES → notification system works, bug is in trigger logic{'\n'}
            NO  → Android channel or permission is the problem
          </Text>
        </View>
      )}

      <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
        {checks.map(c => (
          <Row key={c.id} label={c.id} status={c.status} detail={c.detail} />
        ))}
        {checks.length === 0 && !running && (
          <Text style={s.hint}>Tap "Run checks" to diagnose the notification pipeline step by step.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const s = StyleSheet.create({
  panel:      { backgroundColor: '#111', margin: 8, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#333' },
  titleRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title:      { color: '#fff', fontWeight: '700', fontSize: 13 },
  btn:        { backgroundColor: '#00A86B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnText:    { color: '#fff', fontSize: 12, fontWeight: '600' },
  hint:       { color: '#666', fontSize: 12, textAlign: 'center', paddingVertical: 16 },
  testBanner: { backgroundColor: '#F5A62320', borderRadius: 6, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#F5A62360' },
  testBannerText: { color: '#F5A623', fontSize: 11, lineHeight: 17 },
});