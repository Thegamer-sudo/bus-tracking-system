import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, DURBAN_REGION, ROUTES } from '../../config/constants';
import { getNextArrival, listenToAllBuses } from '../../services/routeService';
import { predictDelay } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';

const getWalkingTime = (distanceKm) => {
  const minutes = Math.round(distanceKm * 12);
  if (minutes < 1) return '< 1 min walk';
  return `${minutes} min walk`;
};

export default function JourneyPlannerScreen({ navigation }) {
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [originModalVisible, setOriginModalVisible] = useState(false);
  const [destinationModalVisible, setDestinationModalVisible] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [boardingOptions, setBoardingOptions] = useState([]);
  const [busPositions, setBusPositions] = useState({});

  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location.coords);
          findNearestStop(location.coords.latitude, location.coords.longitude);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Location error:', error);
        setLoading(false);
      }
    };
    getLocation();
    
    const unsubscribe = listenToAllBuses((buses) => {
      const busMap = {};
      buses.forEach(bus => { busMap[bus.id] = bus; });
      setBusPositions(busMap);
    });
    return () => unsubscribe();
  }, []);

  const findNearestStop = (lat, lng) => {
    let minDist = Infinity;
    let nearest = null;
    for (const [routeId, routeData] of Object.entries(ROUTES)) {
      const allStops = [...routeData.outboundStops, ...routeData.inboundStops];
      for (const stop of allStops) {
        const dist = Math.sqrt(Math.pow(stop.latitude - lat, 2) + Math.pow(stop.longitude - lng, 2));
        if (dist < minDist) {
          minDist = dist;
          nearest = stop;
        }
      }
    }
    setSelectedOrigin(nearest);
    setLoading(false);
  };

  const getDistanceBetweenStops = (stopA, stopB) => {
    return Math.sqrt(Math.pow(stopA.latitude - stopB.latitude, 2) + Math.pow(stopA.longitude - stopB.longitude, 2)) * 111;
  };

  const findRoutesToDestination = (destName) => {
    const routes = [];
    for (const [routeId, routeData] of Object.entries(ROUTES)) {
      const allStops = [...routeData.outboundStops, ...routeData.inboundStops];
      if (allStops.some(s => s.name === destName)) {
        routes.push({ routeId, routeData });
      }
    }
    return routes;
  };

  const getStopsBeforeDestination = (routeData, destName) => {
    const stops = routeData.outboundStops;
    const destIndex = stops.findIndex(s => s.name === destName);
    if (destIndex !== -1) {
      return stops.slice(0, destIndex);
    }
    return [];
  };

  const handleOriginSelect = (stop) => {
    setSelectedOrigin(stop);
    setOriginModalVisible(false);
    setSelectedDestination(null);
    setBoardingOptions([]);
  };

  const handleDestinationSelect = async (destination) => {
    setSelectedDestination(destination);
    setDestinationModalVisible(false);
    
    if (!selectedOrigin) return;
    
    const routesToDest = findRoutesToDestination(destination.name);
    
    if (routesToDest.length === 0) {
      Alert.alert('No Service', `Sorry, no bus serves ${destination.name}.`);
      setBoardingOptions([]);
      return;
    }
    
    const suggestions = [];
    
    for (const { routeId, routeData } of routesToDest) {
      const stopsBefore = getStopsBeforeDestination(routeData, destination.name);
      if (stopsBefore.length === 0) continue;
      
      let closestStop = null;
      let minDist = Infinity;
      
      for (const stop of stopsBefore) {
        const dist = getDistanceBetweenStops(selectedOrigin, stop);
        if (dist < minDist) {
          minDist = dist;
          closestStop = stop;
        }
      }
      
      if (closestStop) {
        const busData = busPositions[routeData.busId];
        const nextArrival = getNextArrival(routeId, 'outbound', closestStop.name);
        const destIndex = routeData.outboundStops.findIndex(s => s.name === destination.name);
        const originIndex = routeData.outboundStops.findIndex(s => s.name === closestStop.name);
        const stopsBetween = destIndex - originIndex;
        
        const predictedDelay = await predictDelay(closestStop.name, routeId, new Date(), []);
        
        suggestions.push({
          routeId,
          routeName: routeData.name,
          boardAt: closestStop,
          destStop: destination.name,
          walkingDistance: minDist,
          walkingTime: getWalkingTime(minDist),
          stopsBetween,
          fare: routeData.baseFare + (stopsBetween - 1) * routeData.farePerStop,
          busLive: busData && busData.status === 'ON_TIME',
          nextArrival,
          predictedDelay,
        });
      }
    }
    
    suggestions.sort((a, b) => a.walkingDistance - b.walkingDistance);
    setBoardingOptions(suggestions);
    
    if (suggestions.length === 0) {
      Alert.alert('No Route Found', `No bus from nearby stops goes to ${destination.name}.`);
    }
  };

  const getAllStops = () => {
    const stopsMap = new Map();
    for (const routeData of Object.values(ROUTES)) {
      for (const stop of routeData.outboundStops) {
        if (!stopsMap.has(stop.name)) stopsMap.set(stop.name, stop);
      }
    }
    return Array.from(stopsMap.values());
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan Your Journey</Text>
        <Text style={styles.subtitle}>Select your starting point and destination</Text>
      </View>

      {/* From selector */}
      <TouchableOpacity style={styles.selectorButton} onPress={() => setOriginModalVisible(true)}>
        <Ionicons name="location-outline" size={24} color={COLORS.primary} />
        <View style={styles.selectorTextContainer}>
          <Text style={styles.selectorLabel}>From</Text>
          <Text style={styles.selectorValue}>{selectedOrigin?.name || 'Select starting stop'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      {/* To selector */}
      <TouchableOpacity style={styles.selectorButton} onPress={() => setDestinationModalVisible(true)}>
        <Ionicons name="navigate-outline" size={24} color={COLORS.danger} />
        <View style={styles.selectorTextContainer}>
          <Text style={styles.selectorLabel}>To</Text>
          <Text style={styles.selectorValue}>{selectedDestination?.name || 'Select destination'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      {/* Journey options */}
      {selectedDestination && selectedOrigin && (
        <ScrollView style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>How to get to {selectedDestination.name}:</Text>
          
          {boardingOptions.length === 0 ? (
            <View style={styles.noResultsCard}>
              <Ionicons name="bus-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.noResultsText}>No buses found</Text>
              <Text style={styles.noResultsSubtext}>Try a different starting point or destination</Text>
            </View>
          ) : (
            boardingOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.routeCard}
                onPress={() => {
                  navigation.navigate('MainTabs', {
                    screen: 'Track',
                    params: {
                      screen: 'LiveTracking',
                      params: {
                        routeId: option.routeId,
                        originStop: option.boardAt.name,
                        destStop: option.destStop,
                        stopsBetween: option.stopsBetween,
                        direction: 'outbound',
                      },
                    },
                  });
                }}
              >
                <View style={styles.routeHeader}>
                  <View style={[styles.routeBadge, { backgroundColor: COLORS.primary }]}>
                    <Text style={styles.routeBadgeText}>{option.routeName}</Text>
                  </View>
                  <Text style={styles.fareText}>R{option.fare.toFixed(2)}</Text>
                </View>
                
                {option.walkingDistance > 0 && (
                  <View style={styles.boardingInfo}>
                    <Ionicons name="walk-outline" size={16} color={COLORS.warning} />
                    <Text style={styles.boardingText}>
                      Walk {option.walkingTime} to {option.boardAt.name}
                    </Text>
                  </View>
                )}
                
                <Text style={styles.routeDetail}>
                  Then {option.stopsBetween} stops to {option.destStop}
                </Text>
                
                {option.nextArrival && (
                  <View style={styles.arrivalContainer}>
                    <Ionicons name="time-outline" size={14} color={COLORS.success} />
                    <Text style={styles.arrivalText}>
                      Next bus: {option.nextArrival.time}
                      {option.nextArrival.minutesAway !== null && ` (in ${option.nextArrival.minutesAway} min)`}
                    </Text>
                  </View>
                )}
                
                {/* AI Prediction Badge */}
                {option.predictedDelay > 2 && (
                  <View style={styles.delayBadge}>
                    <Ionicons name="time-outline" size={12} color={COLORS.warning} />
                    <Text style={styles.delayText}>
                      ⚠️ AI predicted delay: {option.predictedDelay} min
                    </Text>
                  </View>
                )}
                
                <View style={styles.liveBadge}>
                  <Ionicons name={option.busLive ? "radio-button-on" : "time-outline"} size={12} color={option.busLive ? COLORS.success : COLORS.warning} />
                  <Text style={[styles.liveText, { color: option.busLive ? COLORS.success : COLORS.warning }]}>
                    {option.busLive ? 'Live tracking available' : 'Following schedule'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Origin picker modal */}
      <Modal visible={originModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Starting Stop</Text>
              <TouchableOpacity onPress={() => setOriginModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {getAllStops().map((stop, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.stopItem}
                  onPress={() => handleOriginSelect(stop)}
                >
                  <View style={styles.stopItemNumber}>
                    <Text style={styles.stopItemNumberText}>{stop.order}</Text>
                  </View>
                  <View style={styles.stopItemInfo}>
                    <Text style={styles.stopItemName}>{stop.name}</Text>
                    <Text style={styles.stopItemLandmark}>{stop.landmark}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Destination picker modal */}
      <Modal visible={destinationModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Destination</Text>
              <TouchableOpacity onPress={() => setDestinationModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {getAllStops().filter(s => s.name !== selectedOrigin?.name).map((stop, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.stopItem}
                  onPress={() => handleDestinationSelect(stop)}
                >
                  <View style={styles.stopItemNumber}>
                    <Text style={styles.stopItemNumberText}>{stop.order}</Text>
                  </View>
                  <View style={styles.stopItemInfo}>
                    <Text style={styles.stopItemName}>{stop.name}</Text>
                    <Text style={styles.stopItemLandmark}>{stop.landmark}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mini map showing selected stops */}
      <View style={styles.miniMapContainer}>
        <MapView
          style={styles.miniMap}
          provider="google"
          initialRegion={DURBAN_REGION}
          showsUserLocation={!!userLocation}
        >
          {selectedOrigin && (
            <Marker
              coordinate={{ latitude: selectedOrigin.latitude, longitude: selectedOrigin.longitude }}
              title="From"
              pinColor={COLORS.primary}
            />
          )}
          {selectedDestination && (
            <Marker
              coordinate={{ latitude: selectedDestination.latitude, longitude: selectedDestination.longitude }}
              title="To"
              pinColor={COLORS.danger}
            />
          )}
        </MapView>
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayText}>
            {selectedOrigin?.name} → {selectedDestination?.name || '?'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.md },
  header: { paddingHorizontal: SPACING.lg, paddingTop: 56, paddingBottom: SPACING.md },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.heavy, color: COLORS.textPrimary },
  subtitle: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginTop: 4 },
  selectorButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
  selectorTextContainer: { flex: 1 },
  selectorLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  selectorValue: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  optionsContainer: { flex: 1, paddingHorizontal: SPACING.lg },
  optionsTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, marginBottom: SPACING.md },
  routeCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  routeBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary },
  routeBadgeText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  fareText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.primary },
  boardingInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4, backgroundColor: COLORS.warning + '20', padding: 4, borderRadius: RADIUS.sm },
  boardingText: { fontSize: FONTS.sizes.xs, color: COLORS.warning, flex: 1 },
  routeDetail: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  arrivalContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs },
  arrivalText: { fontSize: FONTS.sizes.xs, color: COLORS.success },
  delayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  delayText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
  },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm },
  liveText: { fontSize: FONTS.sizes.xs, color: COLORS.success },
  noResultsCard: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  noResultsText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  noResultsSubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center' },
  miniMapContainer: { height: 150, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  miniMap: { flex: 1 },
  mapOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', padding: SPACING.xs, alignItems: 'center' },
  mapOverlayText: { fontSize: 10, color: COLORS.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  stopItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.md },
  stopItemNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryFaded, justifyContent: 'center', alignItems: 'center' },
  stopItemNumberText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  stopItemInfo: { flex: 1 },
  stopItemName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  stopItemLandmark: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
});