// src/screens/driver/DriverDashboard.js
// Session 2 — adds:
//   • Delay reason modal (DelayReasonModal) instead of instant status flip
//   • Simulated traffic Polyline overlays on the map (trafficService)
//   • Auto-suggest banner when bus enters a heavy traffic zone
//   • Bus change logging modal (writes to bus_changes collection)
//   • Settings gear icon in header

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, ScrollView, Modal,
  TextInput,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  COLORS, FONTS, SPACING, RADIUS,
  ROUTES, INCIDENT_TYPES, DIRECTIONS, DURBAN_REGION,
  BUS_CHANGE_REASONS,
} from '../../config/constants';
import {
  updateBusPosition, listenToIncidents, buildFullRoute, getNextArrival,
} from '../../services/routeService';
import { recordDelayObservation } from '../../services/aiService';
import {
  getCurrentTraffic, isDriverInTraffic,
} from '../../services/trafficService';
import { logBusChange } from '../../services/busChangeService';
import { useAuth } from '../../context/AuthContext';
import DelayReasonModal from '../../components/driver/DelayReasonModal';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [
  { label: '0.5x', ms: 1600 },
  { label: '1x',   ms: 800  },
  { label: '2x',   ms: 400  },
  { label: '4x',   ms: 200  },
  { label: '8x',   ms: 100  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getNearestStopIndex(lat, lng, stops) {
  let min = Infinity, nearest = 0;
  stops.forEach((s, i) => {
    const d = Math.sqrt((s.latitude - lat) ** 2 + (s.longitude - lng) ** 2);
    if (d < min) { min = d; nearest = i; }
  });
  return nearest;
}

function findNearestStop(lat, lng, stops) {
  let min = Infinity, nearestStop = null, nearestIndex = 0;
  stops.forEach((stop, i) => {
    const d = Math.sqrt((stop.latitude - lat) ** 2 + (stop.longitude - lng) ** 2);
    if (d < min) { min = d; nearestStop = stop; nearestIndex = i; }
  });
  return { stop: nearestStop, index: nearestIndex };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverDashboard({ navigation }) {
  const { user, logout } = useAuth();

  const assignedRouteId   = user?.assignedRoute || 'route_520';
  const assignedBusId     = user?.assignedBus   || 'bus_520_001';
  const assignedRouteData = ROUTES[assignedRouteId] || ROUTES.route_520;
  const ROUTE_ID          = assignedRouteId;
  const ROUTE_COLOR       = assignedRouteData.color;

  // ── Core simulation state ────────────────────────────────────────────────
  const [tripActive, setTripActive]         = useState(false);
  const [routeCoords, setRouteCoords]       = useState([]);
  const [segmentCoords, setSegmentCoords]   = useState([]);
  const [busLocation, setBusLocation]       = useState(null);
  const [traveledPath, setTraveledPath]     = useState([]);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [status, setStatus]                 = useState('ON_TIME');
  const [loading, setLoading]               = useState(true);
  const [routeLoaded, setRouteLoaded]       = useState(false);
  const [direction, setDirection]           = useState(DIRECTIONS.OUTBOUND);
  const [speedIndex, setSpeedIndex]         = useState(1);

  // ── Incidents ────────────────────────────────────────────────────────────
  const [activeIncidents, setActiveIncidents]       = useState([]);
  const [incidentPickMode, setIncidentPickMode]     = useState(false);
  const [incidentLocation, setIncidentLocation]     = useState(null);
  const [nearestStopInfo, setNearestStopInfo]       = useState(null);
  const [showIncidentModal, setShowIncidentModal]   = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState('accident');

  // ── Delay reason modal ───────────────────────────────────────────────────
  const [showDelayModal, setShowDelayModal] = useState(false);

  // ── Traffic ──────────────────────────────────────────────────────────────
  const [trafficZones, setTrafficZones]               = useState([]);
  const [trafficSuggestion, setTrafficSuggestion]     = useState(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // ── Bus change modal ─────────────────────────────────────────────────────
  const [showBusChangeModal, setShowBusChangeModal]   = useState(false);
  const [busChangeReason, setBusChangeReason]         = useState('breakdown');
  const [newBusLabel, setNewBusLabel]                 = useState('');
  const [submittingChange, setSubmittingChange]       = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const simulationRef          = useRef(null);
  const mapRef                 = useRef(null);
  const stepRef                = useRef(0);
  const speedIndexRef          = useRef(1);
  const routeCoordsRef         = useRef([]);
  const lastRecordedStopRef    = useRef(-1);
  const suggestionDismissedRef = useRef(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const currentStops = direction === DIRECTIONS.OUTBOUND
    ? assignedRouteData.outboundStops
    : assignedRouteData.inboundStops;

  const currentStop  = currentStops[currentStopIndex];
  const statusColor  = status === 'ON_TIME' ? COLORS.onTime : COLORS.delayed;
  const progress     = routeCoordsRef.current.length > 0
    ? Math.round((stepRef.current / routeCoordsRef.current.length) * 100)
    : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => { speedIndexRef.current = speedIndex; }, [speedIndex]);
  useEffect(() => { suggestionDismissedRef.current = suggestionDismissed; }, [suggestionDismissed]);

  // Load OSRM route whenever direction or route changes
  useEffect(() => {
    setLoading(true);
    setRouteLoaded(false);
    buildFullRoute(currentStops).then(({ allCoords, segmentData }) => {
      setRouteCoords(allCoords);
      routeCoordsRef.current = allCoords;
      setSegmentCoords(segmentData.map(s => s.coords));
      setRouteLoaded(true);
      setLoading(false);
    });
    return () => { if (simulationRef.current) clearInterval(simulationRef.current); };
  }, [assignedRouteId, direction]);

  // Listen to incidents
  useEffect(() => {
    const unsub = listenToIncidents(ROUTE_ID, setActiveIncidents);
    return () => unsub();
  }, [ROUTE_ID]);

  // Load & refresh traffic every 60 seconds
  useEffect(() => {
    const refresh = () => {
      const zones = getCurrentTraffic(ROUTE_ID);
      setTrafficZones(zones);
    };
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [ROUTE_ID]);

  // ─────────────────────────────────────────────────────────────────────────
  // SIMULATION
  // ─────────────────────────────────────────────────────────────────────────

  const startSimulation = useCallback((coords, fromStep = 0) => {
    if (simulationRef.current) clearInterval(simulationRef.current);
    stepRef.current           = fromStep;
    lastRecordedStopRef.current = -1;

    simulationRef.current = setInterval(() => {
      if (stepRef.current >= coords.length) {
        clearInterval(simulationRef.current);
        Alert.alert('Trip Completed', 'You have reached the final destination!');
        return;
      }

      const loc     = coords[stepRef.current];
      const nearest = getNearestStopIndex(loc.latitude, loc.longitude, currentStops);

      setBusLocation(loc);
      setTraveledPath(prev => [...prev, loc]);
      setCurrentStopIndex(nearest);
      updateBusPosition(assignedBusId, loc.latitude, loc.longitude, nearest, status, direction);
      stepRef.current++;

      if (mapRef.current && stepRef.current % 10 === 0) {
        mapRef.current.animateToRegion(
          { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          300,
        );
      }

      if (nearest !== lastRecordedStopRef.current) {
        lastRecordedStopRef.current = nearest;
        const stop = currentStops[nearest];
        if (stop) {
          (async () => {
            try {
              const scheduled = getNextArrival(ROUTE_ID, direction, stop.name, new Date());
              if (scheduled?.time) {
                const [h, m]    = scheduled.time.split(':').map(Number);
                const schedDate = new Date();
                schedDate.setHours(h, m, 0, 0);
                await recordDelayObservation(stop.name, ROUTE_ID, schedDate, new Date(), []);
              }
            } catch (err) {
              console.error('Delay record error:', err);
            }
          })();
        }

        const heavyZone = isDriverInTraffic(ROUTE_ID, nearest);
        if (heavyZone && !suggestionDismissedRef.current) {
          setTrafficSuggestion(heavyZone);
        } else if (!heavyZone) {
          setTrafficSuggestion(null);
          setSuggestionDismissed(false);
        }
      }
    }, SPEED_OPTIONS[speedIndexRef.current].ms);
  }, [assignedBusId, ROUTE_ID, direction, currentStops, status]);

  const changeSpeed = (idx) => {
    setSpeedIndex(idx);
    speedIndexRef.current = idx;
    if (tripActive && routeCoordsRef.current.length > 0) {
      startSimulation(routeCoordsRef.current, stepRef.current);
    }
  };

  const startTrip = () => {
    if (!routeLoaded || routeCoordsRef.current.length === 0) {
      Alert.alert('Route Not Ready', 'Please wait for the route to finish loading.');
      return;
    }
    setTripActive(true);
    setTraveledPath([]);
    setSuggestionDismissed(false);
    startSimulation(routeCoordsRef.current, 0);
  };

  const stopTrip = async () => {
    if (simulationRef.current) clearInterval(simulationRef.current);
    setTripActive(false);
    setBusLocation(null);
    setTraveledPath([]);
    setTrafficSuggestion(null);
    stepRef.current = 0;
    await updateBusPosition(assignedBusId, null, null, null, 'COMPLETED', direction);
    Alert.alert('Trip Ended', 'Trip completed successfully.');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DELAY
  // ─────────────────────────────────────────────────────────────────────────

  const handleDelayedPress = () => {
    if (!tripActive) return;
    setShowDelayModal(true);
  };

  const handleDelayConfirmed = async (reasonKey, estimatedMinutes, note) => {
    setStatus('DELAYED');
    if (busLocation) {
      await updateBusPosition(
        assignedBusId, busLocation.latitude, busLocation.longitude,
        currentStopIndex, 'DELAYED', direction,
      );
    }
    setTrafficSuggestion(null);
    setSuggestionDismissed(true);
  };

  const handleOnTimePress = async () => {
    setStatus('ON_TIME');
    if (tripActive && busLocation) {
      await updateBusPosition(
        assignedBusId, busLocation.latitude, busLocation.longitude,
        currentStopIndex, 'ON_TIME', direction,
      );
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DIRECTION
  // ─────────────────────────────────────────────────────────────────────────

  const handleDirectionChange = (dir) => {
    if (tripActive) {
      Alert.alert('Trip in Progress', 'End the current trip before changing direction.');
      return;
    }
    setDirection(dir);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // INCIDENTS
  // ─────────────────────────────────────────────────────────────────────────

  const handleMapPress = (e) => {
    if (!incidentPickMode) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const nearest = findNearestStop(latitude, longitude, currentStops);
    setIncidentLocation({ latitude, longitude });
    setNearestStopInfo(nearest);
    setShowIncidentModal(true);
  };

  const confirmIncident = async () => {
    if (!incidentLocation || !nearestStopInfo) return;
    try {
      await addDoc(collection(db, 'incidents'), {
        routeId:          ROUTE_ID,
        direction,
        incidentType:     selectedIncidentType,
        blockedStopIndex: nearestStopInfo.index,
        blockedStopName:  nearestStopInfo.stop.name,
        exactLocation:    { latitude: incidentLocation.latitude, longitude: incidentLocation.longitude },
        busStopIndex:     currentStopIndex,
        status:           'ACTIVE',
        timestamp:        serverTimestamp(),
        reportedBy:       'driver',
      });
      setIncidentPickMode(false);
      setIncidentLocation(null);
      setNearestStopInfo(null);
      setShowIncidentModal(false);
      Alert.alert('Incident Reported', `Pinned near ${nearestStopInfo.stop.name}.`);
    } catch { Alert.alert('Error', 'Failed to report incident.'); }
  };

  const cancelIncident = () => {
    setIncidentPickMode(false);
    setIncidentLocation(null);
    setNearestStopInfo(null);
    setShowIncidentModal(false);
  };

  const resolveIncident = async (id) => {
    try { await updateDoc(doc(db, 'incidents', id), { status: 'RESOLVED' }); } catch {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  // BUS CHANGE
  // ─────────────────────────────────────────────────────────────────────────

  const handleBusChangeSubmit = async () => {
    if (!newBusLabel.trim()) {
      Alert.alert('Missing Info', 'Please enter the new bus number/label.');
      return;
    }
    setSubmittingChange(true);
    try {
      await logBusChange({
        routeId:         ROUTE_ID,
        routeName:       assignedRouteData.name,
        oldBusId:        assignedBusId,
        newBusId:        assignedBusId + '_replacement',
        oldBusLabel:     assignedRouteData.busLabel || assignedBusId,
        newBusLabel:     newBusLabel.trim().toUpperCase(),
        reasonKey:       busChangeReason,
        boardingStop:    currentStop?.name || 'City Terminus',
        boardingStopIdx: currentStopIndex,
        createdBy:       user?.uid || 'driver',
        createdByName:   user?.fullName || 'Driver',
      });
      setShowBusChangeModal(false);
      setNewBusLabel('');
      Alert.alert('Bus Change Logged', 'Passengers and admin have been notified.');
    } catch (e) {
      Alert.alert('Error', 'Failed to log bus change. Check your connection.');
    } finally {
      setSubmittingChange(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────

  if (loading && !routeLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ROUTE_COLOR} />
        <Text style={styles.loadingText}>Loading {assignedRouteData.name}...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Driver Dashboard</Text>
          <Text style={styles.headerSub}>{assignedRouteData.name} — {assignedRouteData.description}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('DriverSettings')}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exitBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Route badge */}
      <View style={[styles.routeBadge, { backgroundColor: ROUTE_COLOR + '18', borderColor: ROUTE_COLOR + '60' }]}>
        <View style={[styles.routeDot, { backgroundColor: ROUTE_COLOR }]} />
        <Text style={[styles.routeBadgeText, { color: ROUTE_COLOR }]}>
          {assignedRouteData.name} · {assignedRouteData.description}
        </Text>
        <View style={[styles.busLabelPill, { borderColor: ROUTE_COLOR + '60' }]}>
          <Text style={[styles.busLabelText, { color: ROUTE_COLOR }]}>
            {assignedRouteData.busLabel || assignedBusId}
          </Text>
        </View>
      </View>

      {/* Direction toggle */}
      <View style={styles.directionRow}>
        {[DIRECTIONS.OUTBOUND, DIRECTIONS.INBOUND].map((dir) => {
          const isActive   = direction === dir;
          const stops      = dir === DIRECTIONS.OUTBOUND
            ? assignedRouteData.outboundStops
            : assignedRouteData.inboundStops;
          const first      = stops[0]?.name || '';
          const last       = stops[stops.length - 1]?.name || '';
          return (
            <TouchableOpacity
              key={dir}
              style={[styles.dirBtn, isActive && { borderColor: ROUTE_COLOR, backgroundColor: ROUTE_COLOR + '18' }]}
              onPress={() => handleDirectionChange(dir)}
            >
              <Text style={[styles.dirBtnLabel, isActive && { color: ROUTE_COLOR }]}>
                {dir === DIRECTIONS.OUTBOUND ? 'Outbound' : 'Inbound'}
              </Text>
              <Text style={styles.dirBtnSub} numberOfLines={1}>{first} → {last}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {status === 'ON_TIME' ? 'On Time' : 'Delayed'}
        </Text>
        {tripActive && currentStop && (
          <>
            <Text style={styles.sep}>·</Text>
            <Text style={styles.stopText}>{currentStop.name}</Text>
          </>
        )}
      </View>

      {/* Traffic suggestion banner */}
      {trafficSuggestion && !suggestionDismissed && tripActive && (
        <View style={styles.trafficBanner}>
          <Ionicons name="car" size={16} color={COLORS.warning} />
          <Text style={styles.trafficBannerText}>
            {trafficSuggestion.displayLabel} traffic on {trafficSuggestion.label} — report a delay?
          </Text>
          <TouchableOpacity
            style={styles.trafficReportBtn}
            onPress={() => { setSuggestionDismissed(true); setShowDelayModal(true); }}
          >
            <Text style={styles.trafficReportText}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSuggestionDismissed(true)} style={styles.trafficDismiss}>
            <Ionicons name="close" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Incident pick mode banner */}
      {incidentPickMode && (
        <View style={styles.pickBanner}>
          <Ionicons name="pin" size={16} color={COLORS.white} />
          <Text style={styles.pickBannerText}>Tap the incident location on the map</Text>
          <TouchableOpacity onPress={cancelIncident} style={styles.pickCancel}>
            <Text style={styles.pickCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Progress bar */}
      {tripActive && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: ROUTE_COLOR }]} />
          </View>
          <Text style={styles.progressLabel}>{progress}%</Text>
        </View>
      )}

      {/* Speed selector */}
      <View style={styles.speedRow}>
        <Text style={styles.speedLabel}>Speed:</Text>
        {SPEED_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.label}
            style={[styles.speedBtn, speedIndex === i && [styles.speedBtnActive, { backgroundColor: ROUTE_COLOR, borderColor: ROUTE_COLOR }]]}
            onPress={() => changeSpeed(i)}
          >
            <Text style={[styles.speedBtnText, speedIndex === i && styles.speedBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stop info card */}
      {tripActive && busLocation && (
        <View style={styles.infoCard}>
          <Text style={styles.infoStop}>{currentStop?.name || 'En route'}</Text>
          <Text style={styles.infoSub}>
            Stop {currentStopIndex + 1} of {currentStops.length} · {progress}% complete
          </Text>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapWrap}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={ROUTE_COLOR} />
            <Text style={styles.loaderText}>Loading {assignedRouteData.name}...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider="google"
            initialRegion={DURBAN_REGION}
            showsUserLocation
            onPress={handleMapPress}
          >
            {/* Full route */}
            {routeCoords.length > 0 && (
              <Polyline coordinates={routeCoords} strokeColor={ROUTE_COLOR + '80'} strokeWidth={4} />
            )}

            {/* Traveled path */}
            {traveledPath.length > 1 && (
              <Polyline coordinates={traveledPath} strokeColor={ROUTE_COLOR} strokeWidth={6} />
            )}

            {/*  FIXED: Traffic overlays — use actual OSRM road segments, not straight lines  */}
            {trafficZones.filter(z => z.severity !== 'clear').map((zone, idx) => {
              const roadCoords = segmentCoords[zone.fromStopIndex];
              if (roadCoords && roadCoords.length > 0) {
                return (
                  <Polyline
                    key={`traffic-${idx}`}
                    coordinates={roadCoords}
                    strokeColor={zone.color}
                    strokeWidth={8}
                    lineDashPattern={zone.severity === 'moderate' ? [6, 4] : undefined}
                    zIndex={10}
                  />
                );
              }
              return null;
            })}

            {/* Stop markers */}
            {currentStops.map((stop, index) => (
              <Marker
                key={stop.id}
                coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                title={stop.name}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[
                  styles.stopPin,
                  { borderColor: ROUTE_COLOR },
                  index === currentStopIndex && { backgroundColor: ROUTE_COLOR },
                ]}>
                  <Text style={styles.stopPinText}>{index + 1}</Text>
                </View>
              </Marker>
            ))}

            {/* Incident location preview */}
            {incidentLocation && (
              <Marker coordinate={incidentLocation} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.incidentPreviewPin}>
                  <Ionicons name="warning" size={18} color={COLORS.white} />
                </View>
              </Marker>
            )}

            {/* Active incident markers */}
            {activeIncidents.map((inc, idx) => inc.exactLocation && (
              <Marker key={idx} coordinate={inc.exactLocation} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.activeIncidentPin}>
                  <Ionicons name="alert" size={14} color={COLORS.white} />
                </View>
              </Marker>
            ))}

            {/* Bus marker */}
            {busLocation && (
              <Marker coordinate={busLocation} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.busPin, { backgroundColor: ROUTE_COLOR }]}>
                  <Ionicons name="bus" size={13} color={COLORS.white} />
                  <Text style={styles.busPinText}>{assignedRouteData.name.replace('Route ', '')}</Text>
                </View>
              </Marker>
            )}
          </MapView>
        )}
      </View>

      {/* Trip controls */}
      <View style={styles.controls}>
        {!tripActive ? (
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: ROUTE_COLOR }, !routeLoaded && { opacity: 0.5 }]}
            onPress={startTrip}
            disabled={!routeLoaded}
          >
            <Ionicons name="play-circle-outline" size={22} color={COLORS.white} />
            <Text style={styles.startText}>START TRIP</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.tripControls}>
            <TouchableOpacity
              style={[styles.ctrlBtn, status === 'ON_TIME' && { backgroundColor: ROUTE_COLOR, borderColor: ROUTE_COLOR }]}
              onPress={handleOnTimePress}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.white} />
              <Text style={styles.ctrlBtnText}>On Time</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ctrlBtn, status === 'DELAYED' && { backgroundColor: COLORS.warning, borderColor: COLORS.warning }]}
              onPress={handleDelayedPress}
            >
              <Ionicons name="time-outline" size={14} color={COLORS.white} />
              <Text style={styles.ctrlBtnText}>Delayed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ctrlBtn, { borderColor: COLORS.info }]}
              onPress={() => setShowBusChangeModal(true)}
            >
              <Ionicons name="swap-horizontal-outline" size={14} color={COLORS.info} />
              <Text style={[styles.ctrlBtnText, { color: COLORS.info }]}>Bus ↔</Text>
            </TouchableOpacity>

            {!incidentPickMode && (
              <TouchableOpacity style={[styles.ctrlBtn, { borderColor: COLORS.danger }]} onPress={() => setIncidentPickMode(true)}>
                <Ionicons name="pin-outline" size={14} color={COLORS.danger} />
                <Text style={[styles.ctrlBtnText, { color: COLORS.danger }]}>Pin</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.endBtn} onPress={stopTrip}>
              <Text style={styles.endBtnText}>END</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Active incidents bar */}
      {activeIncidents.length > 0 && (
        <View style={styles.incidentBar}>
          <View style={styles.incidentBarHeader}>
            <Ionicons name="warning" size={14} color={COLORS.danger} />
            <Text style={styles.incidentBarTitle}>
              {activeIncidents.length} active incident{activeIncidents.length > 1 ? 's' : ''}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {activeIncidents.map((inc, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => resolveIncident(inc.id)}
                style={styles.resolveChip}
              >
                <Text style={styles.resolveChipText}>
                  ✓ Resolve {inc.blockedStopName?.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Modals */}
      <DelayReasonModal
        visible={showDelayModal}
        onClose={() => setShowDelayModal(false)}
        onConfirm={handleDelayConfirmed}
        routeId={ROUTE_ID}
        busId={assignedBusId}
        driverUid={user?.uid}
        driverName={user?.fullName}
        currentStopIndex={currentStopIndex}
        currentStopName={currentStop?.name}
      />

      <Modal visible={showIncidentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={22} color={COLORS.danger} />
              <Text style={styles.modalTitle}>What happened here?</Text>
            </View>

            {nearestStopInfo && (
              <View style={styles.locationConfirm}>
                <Ionicons name="location" size={13} color={ROUTE_COLOR} />
                <Text style={[styles.locationConfirmText, { color: ROUTE_COLOR }]}>
                  Near: {nearestStopInfo.stop?.name}
                </Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Incident type:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.entries(INCIDENT_TYPES).map(([type, info]) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    selectedIncidentType === type && { backgroundColor: info.color, borderColor: info.color },
                  ]}
                  onPress={() => setSelectedIncidentType(type)}
                >
                  <Text style={[
                    styles.typeChipText,
                    selectedIncidentType === type && { color: COLORS.white },
                  ]}>
                    {info.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelIncident}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmIncident}>
                <Ionicons name="checkmark" size={16} color={COLORS.white} />
                <Text style={styles.modalConfirmText}>Report Incident</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBusChangeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Ionicons name="swap-horizontal" size={22} color={COLORS.info} />
              <Text style={styles.modalTitle}>Log Bus Change</Text>
            </View>

            <View style={styles.noteInputWrap}>
              <Ionicons name="bus-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.noteInputLabel}>New bus label (e.g. BT-520B):</Text>
            </View>
            <View style={styles.textInputRow}>
              <TextInput
                style={styles.textInput}
                value={newBusLabel}
                onChangeText={setNewBusLabel}
                placeholder="e.g. BT-520B"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                maxLength={12}
              />
            </View>

            <Text style={styles.modalLabel}>Reason:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {BUS_CHANGE_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.typeChip,
                    busChangeReason === r.key && { backgroundColor: COLORS.info, borderColor: COLORS.info },
                  ]}
                  onPress={() => setBusChangeReason(r.key)}
                >
                  <Text style={[
                    styles.typeChipText,
                    busChangeReason === r.key && { color: COLORS.white },
                  ]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={[styles.locationConfirm, { borderColor: COLORS.info + '40', backgroundColor: COLORS.infoFaded }]}>
              <Ionicons name="location" size={13} color={COLORS.info} />
              <Text style={[styles.locationConfirmText, { color: COLORS.info }]}>
                Passengers board at: {currentStop?.name || 'current stop'}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowBusChangeModal(false); setNewBusLabel(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: COLORS.info }, submittingChange && { opacity: 0.6 }]}
                onPress={handleBusChangeSubmit}
                disabled={submittingChange}
              >
                {submittingChange
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <>
                      <Ionicons name="checkmark" size={16} color={COLORS.white} />
                      <Text style={styles.modalConfirmText}>Confirm Change</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText:      { color: COLORS.textSecondary, marginTop: SPACING.md },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 52, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  headerTitle:  { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  headerSub:    { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  exitBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  exitText:     { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs },

  routeBadge:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginBottom: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1 },
  routeDot:       { width: 8, height: 8, borderRadius: 4 },
  routeBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold, flex: 1 },
  busLabelPill:   { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  busLabelText:   { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },

  directionRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm },
  dirBtn:       { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.surface },
  dirBtnLabel:  { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary },
  dirBtnSub:    { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },

  statusRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.xs },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
  sep:        { color: COLORS.textMuted },
  stopText:   { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, flex: 1 },

  trafficBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningFaded, paddingHorizontal: SPACING.lg, paddingVertical: 10, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.warning + '40' },
  trafficBannerText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.warning },
  trafficReportBtn:  { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.warning },
  trafficReportText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  trafficDismiss:    { padding: 4 },

  pickBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger, paddingHorizontal: SPACING.lg, paddingVertical: 12, gap: SPACING.sm },
  pickBannerText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.white, fontWeight: FONTS.weights.semibold },
  pickCancel:     { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.white },
  pickCancelText: { color: COLORS.white, fontSize: FONTS.sizes.xs },

  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: 6, backgroundColor: COLORS.surface },
  progressTrack: { flex: 1, height: 5, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: COLORS.textMuted, width: 36, textAlign: 'right' },

  speedRow:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.lg, paddingVertical: 8, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  speedLabel:       { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginRight: 4 },
  speedBtn:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  speedBtnActive:   {},
  speedBtnText:     { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  speedBtnTextActive: { color: COLORS.white, fontWeight: FONTS.weights.bold },

  infoCard: { paddingHorizontal: SPACING.lg, paddingVertical: 8, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoStop: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  infoSub:  { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },

  mapWrap:    { flex: 1 },
  map:        { flex: 1 },
  loader:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },
  loaderText: { color: COLORS.textSecondary, marginTop: SPACING.sm },

  stopPin:           { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 2.5, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  stopPinText:       { fontSize: 9, fontWeight: '800', color: COLORS.white },
  incidentPreviewPin:{ backgroundColor: COLORS.danger, padding: 10, borderRadius: 22, borderWidth: 2, borderColor: COLORS.white },
  activeIncidentPin: { backgroundColor: COLORS.danger, padding: 6, borderRadius: 16, borderWidth: 2, borderColor: COLORS.white },
  busPin:            { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.white, alignItems: 'center', gap: 3 },
  busPinText:        { color: COLORS.white, fontSize: 11, fontWeight: '800' },

  controls:     { padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  startBtn:     { flexDirection: 'row', paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  startText:    { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  tripControls: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  ctrlBtn:      { flex: 1, minWidth: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 11, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  ctrlBtnText:  { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  endBtn:       { backgroundColor: COLORS.danger, paddingHorizontal: SPACING.lg, paddingVertical: 11, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  endBtnText:   { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },

  incidentBar:       { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: COLORS.dangerFaded, borderTopWidth: 1, borderTopColor: COLORS.border },
  incidentBarHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 6 },
  incidentBarTitle:  { fontSize: FONTS.sizes.sm, color: COLORS.danger, fontWeight: FONTS.weights.bold },
  resolveChip:       { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.xs },
  resolveChipText:   { fontSize: 11, color: COLORS.textSecondary },

  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalBox:            { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xl },
  modalHeader:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  modalTitle:          { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  modalLabel:          { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  locationConfirm:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.primaryFaded, padding: SPACING.sm, borderRadius: RADIUS.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.primary + '40' },
  locationConfirmText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium },
  typeChip:            { backgroundColor: COLORS.surfaceElevated, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  typeChipText:        { color: COLORS.textPrimary, fontSize: FONTS.sizes.xs },
  modalActions:        { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  modalCancelBtn:      { flex: 1, backgroundColor: COLORS.surfaceElevated, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  modalCancelText:     { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  modalConfirmBtn:     { flex: 2, flexDirection: 'row', backgroundColor: COLORS.danger, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  modalConfirmText:    { color: COLORS.white, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },

  textInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    padding: SPACING.md,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1,
  },

  noteInputWrap:  { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, marginBottom: 4 },
  noteInputLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  textInputRow:   { marginBottom: SPACING.md },
});