import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, ROUTE_520_STOPS, DURBAN_REGION } from '../../config/constants';

export default function StopLocatorScreen() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nearestStop, setNearestStop] = useState(null);
  const mapRef = React.useRef(null);

  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location to find nearby stops.');
        setLoading(false);
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      setLocation(current.coords);
      findNearestStop(current.coords);
      setLoading(false);
    } catch (error) {
      Alert.alert('Error', 'Unable to get your location.');
      setLoading(false);
    }
  };

  const findNearestStop = (userLoc) => {
    let minDist = Infinity, closest = null;
    ROUTE_520_STOPS.forEach(stop => {
      const dist = getDistance(userLoc.latitude, userLoc.longitude, stop.latitude, stop.longitude);
      if (dist < minDist) { minDist = dist; closest = stop; }
    });
    setNearestStop({ ...closest, distance: minDist });
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.loadingText}>Finding your location...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}><Ionicons name="location-outline" size={28} color={COLORS.primary} /><Text style={styles.title}>Find Nearest Stop</Text></View>
      {nearestStop && (
        <View style={styles.card}>
          <Text style={styles.stopName}>{nearestStop.name}</Text>
          <Text style={styles.stopLandmark}>{nearestStop.landmark}</Text>
          <View style={styles.distance}><Ionicons name="walk-outline" size={20} color={COLORS.primary} /><Text style={styles.distanceText}>{nearestStop.distance.toFixed(2)} km away</Text></View>
        </View>
      )}
      <View style={styles.mapContainer}>
        <MapView ref={mapRef} style={styles.map} provider="google" initialRegion={DURBAN_REGION} showsUserLocation={true} showsMyLocationButton={true}>
          {ROUTE_520_STOPS.map(stop => (
            <Marker key={stop.id} coordinate={{ latitude: stop.latitude, longitude: stop.longitude }} title={stop.name} description={stop.landmark} pinColor={nearestStop?.id === stop.id ? COLORS.primary : COLORS.border} />
          ))}
        </MapView>
      </View>
      <TouchableOpacity style={styles.refresh} onPress={getCurrentLocation}><Ionicons name="refresh-outline" size={20} color={COLORS.white} /><Text style={styles.refreshText}>Refresh Location</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textSecondary, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, gap: 8 },
  title: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  card: { backgroundColor: COLORS.surface, margin: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  stopName: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  stopLandmark: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4 },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  distanceText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.primary },
  mapContainer: { flex: 1, margin: SPACING.lg, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  map: { flex: 1 },
  refresh: { flexDirection: 'row', backgroundColor: COLORS.primary, margin: SPACING.lg, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: 8 },
  refreshText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
});