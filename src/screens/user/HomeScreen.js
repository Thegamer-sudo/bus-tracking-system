// src/screens/user/HomeScreen.js
// With hardcoded test button for reliable demo notifications

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Dimensions, ActivityIndicator, Modal, Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  COLORS, FONTS, SPACING, RADIUS,
  ROUTE_520_STOPS, ROUTE_520_STOPS_REVERSE,
  ROUTE_520_TIMETABLE, DIRECTIONS, INCIDENT_TYPES,
} from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { listenToBus, listenToIncidents, buildFullRoute } from '../../services/routeService';
import { runAIDiversion } from '../../services/aiService';
import {
  registerForNotifications,
  sendLocalNotification,
  checkBusApproaching,
} from '../../services/notificationService';
import { logNotificationLocally, getLocalNotifications } from '../../services/offlineService';
import StopMarker from '../../components/user/StopMarker';

const BUS_ID = 'bus_520_001';
const { height } = Dimensions.get('window');

function getNextBus(direction) {
  const now = new Date();
  const day = now.getDay();
  const cur = now.getHours() * 60 + now.getMinutes();
  const key = day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
  const side = direction === DIRECTIONS.OUTBOUND ? 'outbound' : 'inbound';
  const times = ROUTE_520_TIMETABLE[key][side];
  for (const t of times) {
    const [h, m] = t.split(':').map(Number);
    if (h * 60 + m > cur) return { time: t, minutesAway: h * 60 + m - cur };
  }
  return { time: times[0], minutesAway: null };
}

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();

  const [direction, setDirection] = useState(DIRECTIONS.OUTBOUND);
  const [originalCoords, setOriginalCoords] = useState([]);
  const [segmentCoords, setSegmentCoords] = useState([]);
  const [diversionCoords, setDiversionCoords] = useState([]);
  const [divSegIdx, setDivSegIdx] = useState(-1);
  const [busData, setBusData] = useState(null);
  const [busPosition, setBusPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nextBus, setNextBus] = useState(getNextBus(DIRECTIONS.OUTBOUND));
  const [selectedStopIndex, setSelectedStopIndex] = useState(null);
  const [showStopPicker, setShowStopPicker] = useState(false);
  const [diversionActive, setDiversionActive] = useState(false);
  const [diversionResult, setDiversionResult] = useState(null);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [activeDelay, setActiveDelay] = useState(null);

  // Refs to avoid stale closures
  const notifiedStopsRef = useRef(new Set());
  const selectedStopIndexRef = useRef(null);
  const mapRef = useRef(null);

  const currentStops = direction === DIRECTIONS.OUTBOUND
    ? ROUTE_520_STOPS
    : ROUTE_520_STOPS_REVERSE;

  // Update ref when selectedStopIndex changes
  useEffect(() => {
    selectedStopIndexRef.current = selectedStopIndex;
  }, [selectedStopIndex]);

  // ── Load OSRM route ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setDiversionActive(false);
    setDiversionCoords([]);
    setDivSegIdx(-1);

    buildFullRoute(currentStops).then(({ allCoords, segmentData }) => {
      setOriginalCoords(allCoords);
      setSegmentCoords(segmentData.map(s => s.coords));
      setLoading(false);
    });

    const tick = setInterval(() => setNextBus(getNextBus(direction)), 30000);
    return () => clearInterval(tick);
  }, [direction]);

  // ── Listen to bus position ───────────────────────────────────────────────
  useEffect(() => {
    registerForNotifications();

    const unsub = listenToBus(BUS_ID, (data) => {
      console.log('🚍 Bus update received - stop:', data.currentStopIndex);
      setBusData(data);
      if (data.latitude && data.longitude) {
        setBusPosition({ latitude: data.latitude, longitude: data.longitude });
      }

      const targetIdx = selectedStopIndexRef.current;
      if (targetIdx !== null && data.currentStopIndex !== undefined) {
        const key = `${data.currentStopIndex}-${targetIdx}`;
        if (!notifiedStopsRef.current.has(key)) {
          notifiedStopsRef.current.add(key);
          console.log('🔔 Bus approaching trigger - stops away:', targetIdx - data.currentStopIndex);
          checkBusApproaching(
            data.currentStopIndex,
            targetIdx,
            currentStops[targetIdx]?.name,
          );
        }
      }
    });

    return () => unsub();
  }, []);

  // ── Listen to active delays (ALL routes) - NO orderBy to avoid index error ──
  useEffect(() => {
    console.log('🔍 Setting up delay listener for ALL routes');
    
    const q = query(
      collection(db, 'delays'),
      where('status', '==', 'ACTIVE'),
    );

    const unsub = onSnapshot(q, (snap) => {
      console.log('🔔 Delay snapshot received! Size:', snap.size);
      if (!snap.empty) {
        const delays = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        delays.sort((a, b) => {
          const timeA = a.timestamp?.toDate?.() || new Date(0);
          const timeB = b.timestamp?.toDate?.() || new Date(0);
          return timeB - timeA;
        });
        const latest = delays[0];
        console.log('📋 Latest delay from Firestore:', latest.reasonLabel, latest.estimatedDelayMinutes, 'min on', latest.routeId);
        setActiveDelay(latest);
        
        sendLocalNotification(
          `⚠️ Delay Alert - ${latest.routeId?.replace('route_', 'Route ') || 'Bus'}`,
          `${latest.reasonLabel || latest.reason}: ${latest.estimatedDelayMinutes} min delay`
        );
        
        logNotificationLocally({
          title: `⚠️ Delay on ${latest.routeId?.replace('route_', 'Route ') || 'Bus'}`,
          body: `${latest.reasonLabel || latest.reason}: ${latest.estimatedDelayMinutes} min delay`,
          type: 'delay',
          timestamp: new Date().toISOString(),
        }).catch(err => console.warn('Failed to log notification:', err));
      } else {
        setActiveDelay(null);
      }
    }, (err) => {
      console.warn('[HomeScreen] Delay listener error:', err.message);
    });

    return () => unsub();
  }, []);

  // ── Listen to incidents ──────────────────────────────────────────────────
  useEffect(() => {
    if (segmentCoords.length === 0) return;

    const unsub = listenToIncidents('route_520', async (incidents) => {
      setActiveIncidents(incidents);

      if (incidents.length > 0 && !diversionActive) {
        const inc = incidents[0];
        const result = await runAIDiversion(
          currentStops, segmentCoords,
          inc.blockedStopIndex, inc.incidentType,
          busData?.currentStopIndex || 0, direction,
        );

        if (result) {
          setDiversionCoords(result.best.coords);
          setDivSegIdx(result.segIdx);
          setDiversionResult(result);
          setDiversionActive(true);
          const incInfo = INCIDENT_TYPES?.[inc.incidentType] || { label: inc.incidentType };
          sendLocalNotification(
            'Route 520 Alert',
            `${incInfo.label} near ${inc.blockedStopName}. +${result.best.estimatedDelay} min.`,
          );
          logNotificationLocally({
            title: '⚠️ Route 520 Incident',
            body: `${incInfo.label} reported near ${inc.blockedStopName}`,
            type: 'incident',
            timestamp: new Date().toISOString(),
          }).catch(err => console.warn('Failed to log incident notification:', err));
        }
      }

      if (incidents.length === 0 && diversionActive) {
        setDiversionActive(false);
        setDiversionCoords([]);
        setDivSegIdx(-1);
        setDiversionResult(null);
      }
    });

    return () => unsub();
  }, [segmentCoords, diversionActive, direction, currentStops, busData]);

  // ── Hardcoded Demo Notification Function ─────────────────────────────────
  const triggerDemoNotification = async () => {
    console.log('🔴 DEMO BUTTON PRESSED - Creating test notification');
    
    // Show banner
    setActiveDelay({
      routeId: 'route_520',
      reasonLabel: 'Heavy Traffic (Demo)',
      estimatedDelayMinutes: 10,
      stopName: 'Umbilo Road'
    });
    
    // Send push notification
    await sendLocalNotification(
      '⚠️ Demo Delay Alert - Route 520',
      'Heavy Traffic: 10 min delay near Umbilo Road'
    );
    
    // Save to notification history
    await logNotificationLocally({
      title: '⚠️ Delay on Route 520',
      body: 'Heavy Traffic: 10 min delay expected near Umbilo Road',
      type: 'delay',
      timestamp: new Date().toISOString(),
    });
    
    // Verify it was saved
    const notifications = await getLocalNotifications();
    console.log('📋 Current notifications in storage:', notifications.length);
    
    Alert.alert('Demo Success', 'Notification sent! Check the Alerts tab 📱');
  };

  // ── Derived values ───────────────────────────────────────────────────────
  const status = busData?.status || 'ON_TIME';
  const statusColor = status === 'ON_TIME' ? COLORS.onTime : status === 'DELAYED' ? COLORS.delayed : COLORS.cancelled;
  const statusLabel = status === 'ON_TIME' ? 'On Time' : status === 'DELAYED' ? 'Delayed' : status === 'FULL' ? 'Full' : 'Cancelled';
  const selectedStop = selectedStopIndex !== null ? currentStops[selectedStopIndex] : null;
  const stopsAway = selectedStopIndex !== null && busData?.currentStopIndex !== undefined
    ? selectedStopIndex - busData.currentStopIndex : null;
  const blockedStopIndex = activeIncidents[0]?.blockedStopIndex ?? -1;

  const segBefore = diversionActive && divSegIdx > 0
    ? segmentCoords.slice(0, divSegIdx).reduce((acc, s, i) => i === 0 ? [...acc, ...s] : [...acc, ...s.slice(1)], [])
    : originalCoords;
  const segAfter = diversionActive && divSegIdx >= 0 && divSegIdx < segmentCoords.length - 1
    ? segmentCoords.slice(divSegIdx + 1).reduce((acc, s, i) => i === 0 ? [...acc, ...s] : [...acc, ...s.slice(1)], [])
    : [];

  const handleSelectStop = (index) => {
    notifiedStopsRef.current = new Set();
    setSelectedStopIndex(index);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
            {user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </Text>
          <Text style={styles.headerSub}>
            Route 520 — {direction === DIRECTIONS.OUTBOUND ? 'Woodlands → City' : 'City → Woodlands'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* 🔴 DEMO BUTTON - For reliable notification testing */}
          <TouchableOpacity 
            style={styles.demoBtn}
            onPress={triggerDemoNotification}
          >
            <Text style={styles.demoBtnText}>🔴 Demo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('UserSettings')}>
            <Ionicons name="settings-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dirBtn, direction === DIRECTIONS.OUTBOUND && styles.dirBtnActive]}
            onPress={() => setDirection(DIRECTIONS.OUTBOUND)}
          >
            <Text style={styles.dirBtnText}>Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dirBtn, direction === DIRECTIONS.INBOUND && styles.dirBtnActive]}
            onPress={() => setDirection(DIRECTIONS.INBOUND)}
          >
            <Text style={styles.dirBtnText}>In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        <Text style={styles.statusSep}>·</Text>
        <Text style={styles.nextBusText}>
          {busPosition
            ? 'Bus is live'
            : nextBus.minutesAway !== null
            ? `Next bus in ${nextBus.minutesAway} min (${nextBus.time})`
            : `Next bus at ${nextBus.time}`}
        </Text>
      </View>

      {/* Delay Banner */}
      {activeDelay && (
        <View style={styles.delayBanner}>
          <Ionicons name="time-outline" size={16} color={COLORS.warning} />
          <Text style={styles.delayBannerText}>
            {activeDelay.routeId?.replace('route_', 'Route ')} Delay: {activeDelay.reasonLabel || activeDelay.reason}
            {activeDelay.estimatedDelayMinutes ? ` — ~${activeDelay.estimatedDelayMinutes} min` : ''}
            {activeDelay.stopName ? ` near ${activeDelay.stopName}` : ''}
          </Text>
        </View>
      )}

      {/* Diversion banner */}
      {diversionActive && (
        <View style={styles.diversionBar}>
          <Ionicons name="warning" size={16} color={COLORS.warning} />
          <Text style={styles.diversionText}>
            {`Diversion active — ${activeIncidents[0]?.incidentType || ''} near ${activeIncidents[0]?.blockedStopName || ''} (+${diversionResult?.best?.estimatedDelay || '?'} min)`}
          </Text>
        </View>
      )}

      {/* Bus info card */}
      {busData && selectedStop && (
        <View style={styles.busInfoCard}>
          <View style={styles.busInfoRow}>
            <Ionicons name="bus-outline" size={16} color={COLORS.primary} />
            <Text style={styles.busInfoLabel}>Bus is at:</Text>
            <Text style={styles.busInfoValue}>
              {busData.currentStopIndex !== undefined
                ? currentStops[busData.currentStopIndex]?.name
                : '—'}
            </Text>
          </View>
          <View style={styles.busInfoRow}>
            <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
            <Text style={styles.busInfoLabel}>Stops from you:</Text>
            <Text style={[styles.busInfoValue, stopsAway <= 2 && { color: COLORS.warning }]}>
              {stopsAway} stop{stopsAway !== 1 ? 's' : ''} away
            </Text>
          </View>
          {stopsAway === 1 && (
            <View style={styles.alertCard}>
              <Ionicons name="alert-circle" size={16} color={COLORS.warning} />
              <Text style={styles.alertText}>Bus approaching — get ready.</Text>
            </View>
          )}
          {stopsAway === 0 && (
            <View style={[styles.alertCard, { borderColor: COLORS.success, backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.alertText}>Bus has arrived — board now.</Text>
            </View>
          )}
        </View>
      )}

      {/* Selected stop bar */}
      {selectedStop && (
        <View style={styles.selectedStopBar}>
          <Text style={styles.selectedStopLabel}>Tracking:</Text>
          <Text style={styles.selectedStopName}>{selectedStop.name}</Text>
          <TouchableOpacity onPress={() => handleSelectStop(null)}>
            <Text style={styles.clearStop}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.mapLoader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.mapLoaderText}>Loading real Durban route...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider="google"
            initialRegion={{ latitude: -29.8700, longitude: 30.9850, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
            showsUserLocation
            showsMyLocationButton
          >
            {!diversionActive && originalCoords.length > 0 && (
              <Polyline coordinates={originalCoords} strokeColor={COLORS.primary} strokeWidth={4} />
            )}
            {diversionActive && (
              <>
                {segBefore.length > 0 && <Polyline coordinates={segBefore} strokeColor={COLORS.primary} strokeWidth={4} />}
                {diversionCoords.length > 0 && <Polyline coordinates={diversionCoords} strokeColor={COLORS.warning} strokeWidth={5} />}
                {segAfter.length > 0 && <Polyline coordinates={segAfter} strokeColor={COLORS.primary} strokeWidth={4} />}
              </>
            )}
            {currentStops.map((stop, index) => (
              <Marker
                key={stop.id + '_' + direction}
                coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                title={stop.name}
                description={stop.landmark}
                onPress={() => handleSelectStop(index)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <StopMarker
                  number={index + 1}
                  isSelected={index === selectedStopIndex}
                  isCurrent={busData?.currentStopIndex === index}
                  isBlocked={index === blockedStopIndex}
                />
              </Marker>
            ))}
            {busPosition && (
              <Marker coordinate={busPosition} title="Bus 520" anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.busMarker}>
                  <Ionicons name="bus" size={14} color={COLORS.white} />
                  <Text style={styles.busMarkerText}>520</Text>
                </View>
              </Marker>
            )}
          </MapView>
        )}
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Stops — Route 520</Text>
          <TouchableOpacity style={styles.trackBtn} onPress={() => setShowStopPicker(true)}>
            <Ionicons name="notifications" size={14} color={COLORS.primary} />
            <Text style={styles.trackBtnText}>Track My Stop</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stopsList}>
          {currentStops.map((stop, index) => {
            const isBlocked = index === blockedStopIndex;
            const dist = busData?.currentStopIndex !== undefined
              ? Math.abs(busData.currentStopIndex - index) : null;
            return (
              <TouchableOpacity
                key={stop.id + '_' + direction}
                style={[
                  styles.stopCard,
                  index === selectedStopIndex && styles.stopCardSelected,
                  isBlocked && styles.stopCardBlocked,
                ]}
                onPress={() => handleSelectStop(index)}
              >
                <View style={[styles.stopNumber, isBlocked && { backgroundColor: COLORS.danger + '30' }]}>
                  <Text style={[styles.stopNumberText, isBlocked && { color: COLORS.danger }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.stopName, isBlocked && { color: COLORS.danger }]}>{stop.name}</Text>
                <Text style={styles.stopLandmark} numberOfLines={2}>{stop.landmark}</Text>
                {isBlocked && <Text style={styles.blockedTag}>BLOCKED</Text>}
                {dist !== null && !isBlocked && (
                  <View style={[styles.distBadge, dist <= 2 && styles.distBadgeNear]}>
                    <Text style={styles.distBadgeText}>{dist} away</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('StopLocator')}>
            <Ionicons name="location-outline" size={16} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Nearest Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('JourneyPlanner')}>
            <Ionicons name="map-outline" size={16} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Plan Journey</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={logout}>
            <Ionicons name="log-out-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.actionBtnOutlineText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stop picker modal */}
      <Modal visible={showStopPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Stop</Text>
            <Text style={styles.modalSub}>You will be notified when the bus is approaching</Text>
            <ScrollView>
              {currentStops.map((stop, index) => (
                <TouchableOpacity
                  key={stop.id}
                  style={styles.modalItem}
                  onPress={() => { handleSelectStop(index); setShowStopPicker(false); }}
                >
                  <View style={styles.modalNum}>
                    <Text style={styles.modalNumText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalName}>{stop.name}</Text>
                    <Text style={styles.modalLandmark}>{stop.landmark}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowStopPicker(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  greeting: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  headerSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  demoBtn: { backgroundColor: '#E53935', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 4 },
  demoBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  dirBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  dirBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dirBtnText: { color: COLORS.textPrimary, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold },
  notifBtn: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statusBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.xs },
  statusText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
  statusSep: { color: COLORS.textMuted, marginHorizontal: SPACING.xs },
  nextBusText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, flex: 1 },
  delayBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningFaded, paddingHorizontal: SPACING.lg, paddingVertical: 10, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.warning + '40' },
  delayBannerText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.warning },
  diversionBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warning + '25', paddingHorizontal: SPACING.lg, paddingVertical: 10, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.warning + '50' },
  diversionText: { fontSize: FONTS.sizes.sm, color: COLORS.warning, flex: 1 },
  busInfoCard: { backgroundColor: COLORS.surface, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.xs },
  busInfoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  busInfoLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, flex: 1 },
  busInfoValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs, padding: SPACING.sm, backgroundColor: COLORS.warning + '20', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.warning },
  alertText: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, flex: 1 },
  selectedStopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: COLORS.primaryFaded, borderBottomWidth: 1, borderBottomColor: COLORS.primary, gap: SPACING.sm },
  selectedStopLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  selectedStopName: { flex: 1, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.primary },
  clearStop: { fontSize: FONTS.sizes.xs, color: COLORS.danger },
  mapContainer: { height: height * 0.36 },
  map: { flex: 1 },
  mapLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },
  mapLoaderText: { color: COLORS.textSecondary, marginTop: SPACING.sm, fontSize: FONTS.sizes.sm },
  busMarker: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingHorizontal: 9, paddingVertical: 5, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.white, alignItems: 'center', gap: 3 },
  busMarkerText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  bottomSheet: { flex: 1, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  sheetTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  trackBtn: { flexDirection: 'row', backgroundColor: COLORS.primaryFaded, paddingHorizontal: SPACING.md, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', gap: 4 },
  trackBtnText: { color: COLORS.primary, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold },
  stopsList: { paddingLeft: SPACING.lg },
  stopCard: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, padding: SPACING.md, marginRight: SPACING.sm, width: 130, borderWidth: 1, borderColor: COLORS.border },
  stopCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaded },
  stopCardBlocked: { borderColor: COLORS.danger, backgroundColor: COLORS.danger + '15' },
  stopNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primaryFaded, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stopNumberText: { color: COLORS.primary, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  stopName: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, marginBottom: 2 },
  stopLandmark: { fontSize: 10, color: COLORS.textSecondary },
  blockedTag: { marginTop: 4, fontSize: 9, fontWeight: '700', color: COLORS.danger },
  distBadge: { marginTop: 4, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignSelf: 'flex-start' },
  distBadgeNear: { backgroundColor: COLORS.warning + '30', borderColor: COLORS.warning },
  distBadgeText: { fontSize: 9, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  actionBtn: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionBtnText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  actionBtnOutlineText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '80%' },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: 4 },
  modalSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  modalItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primaryFaded, justifyContent: 'center', alignItems: 'center' },
  modalNumText: { color: COLORS.primary, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  modalName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  modalLandmark: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  modalClose: { backgroundColor: COLORS.surfaceElevated, paddingVertical: 15, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  modalCloseText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.md },
});