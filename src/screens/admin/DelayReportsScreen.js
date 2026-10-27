// src/screens/admin/DelayReportsScreen.js
// View and manage delay reports from drivers

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS, ROUTES } from '../../config/constants';

export default function DelayReportsScreen() {
  const [delays, setDelays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'delays'),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const delayList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDelays(delayList);
      setLoading(false);
    }, (error) => {
      console.error('Error loading delays:', error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const resolveDelay = async (delayId) => {
    try {
      await updateDoc(doc(db, 'delays', delayId), {
        status: 'RESOLVED',
        resolvedAt: new Date()
      });
      Alert.alert('Success', 'Delay marked as resolved');
    } catch (error) {
      console.error('Error resolving delay:', error);
      Alert.alert('Error', 'Failed to resolve delay');
    }
  };

  const getRouteColor = (routeId) => {
    const route = ROUTES[routeId];
    return route?.color || COLORS.textMuted;
  };

  const getStatusColor = (status) => {
    return status === 'ACTIVE' ? COLORS.warning : COLORS.success;
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return 'Unknown';
    return timestamp.toDate().toLocaleString();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading delays...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Delay Reports</Text>
        <Text style={styles.sectionSubtitle}>
          {delays.filter(d => d.status === 'ACTIVE').length} active, {delays.length} total
        </Text>

        {delays.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.success} />
            <Text style={styles.emptyStateText}>No delay reports</Text>
            <Text style={styles.emptyStateSubtext}>All buses are running on time</Text>
          </View>
        ) : (
          delays.map((delay) => (
            <View key={delay.id} style={styles.delayCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.routeBadge, { backgroundColor: getRouteColor(delay.routeId) + '20', borderColor: getRouteColor(delay.routeId) }]}>
                  <Text style={[styles.routeBadgeText, { color: getRouteColor(delay.routeId) }]}>
                    {delay.routeId?.replace('route_', 'Route ') || 'Unknown'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delay.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(delay.status) }]}>
                    {delay.status || 'ACTIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.driverName}>
                  {delay.driverName || 'Unknown Driver'}
                </Text>
                <Text style={styles.delayReason}>
                  <Text style={styles.label}>Reason:</Text> {delay.reasonLabel || delay.reason}
                </Text>
                <Text style={styles.delayMinutes}>
                  <Text style={styles.label}>Est. Delay:</Text> {delay.estimatedDelayMinutes} minutes
                </Text>
                {delay.stopName && (
                  <Text style={styles.stopName}>
                    <Text style={styles.label}>Location:</Text> Near {delay.stopName}
                  </Text>
                )}
                {delay.customNote && (
                  <Text style={styles.note}>
                    <Text style={styles.label}>Note:</Text> {delay.customNote}
                  </Text>
                )}
                <Text style={styles.timestamp}>
                  {formatTime(delay.timestamp)}
                </Text>
              </View>

              {delay.status === 'ACTIVE' && (
                <TouchableOpacity
                  style={styles.resolveBtn}
                  onPress={() => resolveDelay(delay.id)}
                >
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                  <Text style={styles.resolveBtnText}>Resolve</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.md },
  content: { padding: SPACING.lg },
  sectionTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  sectionSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.lg },
  
  emptyState: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyStateText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  emptyStateSubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center' },
  
  delayCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  routeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  routeBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold },
  
  cardBody: { padding: SPACING.md, gap: SPACING.xs },
  driverName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, marginBottom: 4 },
  delayReason: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary },
  delayMinutes: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary },
  stopName: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary },
  note: { fontSize: FONTS.sizes.sm, color: COLORS.warning, marginTop: 4, fontStyle: 'italic' },
  timestamp: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 8 },
  label: { color: COLORS.textSecondary },
  
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.success,
  },
  resolveBtnText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
});