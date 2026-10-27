// src/screens/user/LiveTrackingScreen.js
// Dark theme version matching submitted documentation

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ActivityIndicator
} from 'react-native';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS, DURBAN_REGION, ROUTES } from '../../config/constants';
import { listenToBus, buildFullRoute } from '../../services/routeService';

export default function LiveTrackingScreen({ navigation }) {
  const route = useRoute();
  const routeParams = route.params?.params || route.params || {};

  const [loading, setLoading] = useState(true);
  const [busPosition, setBusPosition] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [journeyInfo, setJourneyInfo] = useState(null);
  const [activeDelay, setActiveDelay] = useState(null);
  const mapRef = useRef(null);

  // 1. Load journey info
  useEffect(() => {
    if (!routeParams.routeId) {
      setLoading(false);
      return;
    }
    setJourneyInfo({
      routeId: routeParams.routeId,
      originStop: routeParams.originStop,
      destStop: routeParams.destStop,
      stopsBetween: routeParams.stopsBetween,
      direction: routeParams.direction || 'outbound',
    });
    loadRoute();
  }, [routeParams]);

  const loadRoute = async () => {
    const routeId = journeyInfo?.routeId || routeParams.routeId;
    const direction = journeyInfo?.direction || routeParams.direction || 'outbound';
    const routeData = ROUTES[routeId];
    if (!routeData) return;
    const stops = direction === 'outbound' ? routeData.outboundStops : routeData.inboundStops;
    const { allCoords } = await buildFullRoute(stops);
    setRouteCoords(allCoords);
    setLoading(false);
  };

  // 2. Real-time bus position + force-follow
  useEffect(() => {
    const routeId = journeyInfo?.routeId || routeParams.routeId;
    if (!routeId) return;
    const routeData = ROUTES[routeId];
    const busId = routeData?.busId;
    if (!busId) return;

    const unsubscribe = listenToBus(busId, (data) => {
      if (data.latitude && data.longitude) {
        setBusPosition({ latitude: data.latitude, longitude: data.longitude });
        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: data.latitude,
              longitude: data.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            200
          );
        }
      }
    });
    return () => unsubscribe();
  }, [journeyInfo, routeParams]);

  // 3. Active delay listener
  useEffect(() => {
    const routeId = journeyInfo?.routeId || routeParams.routeId;
    if (!routeId) return;
    const q = query(
      collection(db, 'delays'),
      where('routeId', '==', routeId),
      where('status', '==', 'ACTIVE'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveDelay({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveDelay(null);
      }
    });
    return () => unsubscribe();
  }, [journeyInfo, routeParams]);

  if (!routeParams.routeId) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="bus-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.centerTitle}>No Journey Selected</Text>
        <Text style={styles.centerSubtitle}>
          Plan a journey from the Plan tab to start tracking your bus
        </Text>
        <TouchableOpacity style={styles.goToPlanBtn} onPress={() => navigation.navigate('Plan')}>
          <Text style={styles.goToPlanBtnText}>Go to Plan Tab</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading tracking...</Text>
      </View>
    );
  }

  const displayOrigin = journeyInfo?.originStop || routeParams.originStop;
  const displayDest = journeyInfo?.destStop || routeParams.destStop;
  const displayStops = journeyInfo?.stopsBetween || routeParams.stopsBetween;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <Text style={styles.headerSub}>{displayOrigin} → {displayDest}</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider="google"
          initialRegion={DURBAN_REGION}
          showsUserLocation
          showsMyLocationButton
        >
          {routeCoords.length > 0 && (
            <Polyline coordinates={routeCoords} strokeColor={COLORS.primary} strokeWidth={4} />
          )}
          {busPosition && (
            <>
              <Marker coordinate={busPosition} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.busMarker}>
                  <View style={styles.busInner} />
                </View>
              </Marker>
              <Circle
                center={busPosition}
                radius={12}
                strokeColor={COLORS.primary}
                strokeWidth={2}
                fillColor={COLORS.primary + '40'}
              />
            </>
          )}
        </MapView>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="bus-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoLabel}>Estimated stops:</Text>
          <Text style={styles.infoValue}>{displayStops} stops</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoLabel}>Bus status:</Text>
          <Text style={[styles.infoValue, { color: busPosition ? COLORS.success : COLORS.warning }]}>
            {busPosition ? 'Live' : 'Waiting for signal'}
          </Text>
        </View>
        {activeDelay && (
          <View style={styles.delayWarning}>
            <Ionicons name="alert-circle" size={16} color={COLORS.warning} />
            <Text style={styles.delayWarningText}>
              ⚠️ {activeDelay.reasonLabel || activeDelay.reason}: ~{activeDelay.estimatedDelayMinutes} min delay
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: COLORS.background, 
    padding: SPACING.xl 
  },
  centerTitle: { 
    fontSize: FONTS.sizes.xl, 
    fontWeight: FONTS.weights.bold, 
    color: COLORS.textPrimary, 
    marginTop: SPACING.lg 
  },
  centerSubtitle: { 
    fontSize: FONTS.sizes.sm, 
    color: COLORS.textSecondary, 
    textAlign: 'center', 
    marginTop: SPACING.sm, 
    marginBottom: SPACING.lg 
  },
  loadingText: { 
    color: COLORS.textSecondary, 
    marginTop: SPACING.md 
  },
  goToPlanBtn: { 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: SPACING.xl, 
    paddingVertical: SPACING.md, 
    borderRadius: RADIUS.md 
  },
  goToPlanBtnText: { 
    color: COLORS.white, 
    fontSize: FONTS.sizes.md, 
    fontWeight: FONTS.weights.bold 
  },
  header: { 
    paddingHorizontal: SPACING.lg, 
    paddingTop: 56, 
    paddingBottom: SPACING.md 
  },
  headerTitle: { 
    fontSize: FONTS.sizes.xxxl, 
    fontWeight: FONTS.weights.heavy, 
    color: COLORS.textPrimary 
  },
  headerSub: { 
    fontSize: FONTS.sizes.md, 
    color: COLORS.textSecondary, 
    marginTop: 4 
  },
  mapContainer: { 
    flex: 1, 
    marginHorizontal: SPACING.md, 
    borderRadius: RADIUS.md, 
    overflow: 'hidden', 
    marginBottom: SPACING.md 
  },
  map: { flex: 1 },

  busMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  busInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },

  infoCard: { 
    backgroundColor: COLORS.surface, 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.lg, 
    padding: SPACING.md, 
    borderRadius: RADIUS.md, 
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: SPACING.sm, 
    gap: SPACING.sm 
  },
  infoLabel: { 
    fontSize: FONTS.sizes.sm, 
    color: COLORS.textSecondary, 
    flex: 1 
  },
  infoValue: { 
    fontSize: FONTS.sizes.sm, 
    fontWeight: FONTS.weights.semibold, 
    color: COLORS.textPrimary 
  },
  delayWarning: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: SPACING.sm, 
    paddingTop: SPACING.sm, 
    borderTopWidth: 1, 
    borderTopColor: COLORS.border, 
    gap: SPACING.sm 
  },
  delayWarningText: { 
    flex: 1, 
    fontSize: FONTS.sizes.sm, 
    color: COLORS.warning, 
    fontWeight: FONTS.weights.medium 
  },
});