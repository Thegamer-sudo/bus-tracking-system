// src/screens/admin/AnalyticsScreen.js
// Statistics dashboard with cards and charts

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS, ROUTES, DELAY_REASONS } from '../../config/constants';

export default function AnalyticsScreen() {
  const [stats, setStats] = useState({
    totalDelaysToday: 0,
    activeIncidents: 0,
    busesOnTime: 0,
    totalBuses: 3,
    delaysByRoute: {},
    delayReasons: {},
    recentDelays: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get delays from today
      const delaysQuery = query(
        collection(db, 'delays'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      const delaysSnap = await getDocs(delaysQuery);
      const delays = delaysSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const todayDelays = delays.filter(d => {
        if (!d.timestamp?.toDate) return false;
        return d.timestamp.toDate() >= today;
      });
      
      // Get active incidents
      const incidentsQuery = query(
        collection(db, 'incidents'),
        where('status', '==', 'ACTIVE')
      );
      const incidentsSnap = await getDocs(incidentsQuery);
      
      // Get bus statuses
      const busesQuery = query(collection(db, 'buses'));
      const busesSnap = await getDocs(busesQuery);
      const buses = busesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const onTimeBuses = buses.filter(b => b.status === 'ON_TIME').length;
      
      // Calculate delays by route
      const delaysByRoute = {};
      delays.forEach(d => {
        const routeId = d.routeId || 'unknown';
        delaysByRoute[routeId] = (delaysByRoute[routeId] || 0) + 1;
      });
      
      // Calculate delay reasons
      const delayReasons = {};
      delays.forEach(d => {
        const reason = d.reason || 'other';
        delayReasons[reason] = (delayReasons[reason] || 0) + 1;
      });
      
      setStats({
        totalDelaysToday: todayDelays.length,
        activeIncidents: incidentsSnap.size,
        busesOnTime: onTimeBuses,
        totalBuses: buses.length || 3,
        delaysByRoute,
        delayReasons,
        recentDelays: delays.slice(0, 5),
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReasonLabel = (reasonKey) => {
    const reason = DELAY_REASONS.find(r => r.key === reasonKey);
    return reason?.label || reasonKey;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  const onTimePercentage = Math.round((stats.busesOnTime / stats.totalBuses) * 100);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Analytics Dashboard</Text>
        <Text style={styles.sectionSubtitle}>Today's overview</Text>
        
        {/* Stat Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.warning} />
            <Text style={styles.statNumber}>{stats.totalDelaysToday}</Text>
            <Text style={styles.statLabel}>Delays Today</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="warning-outline" size={24} color={COLORS.danger} />
            <Text style={styles.statNumber}>{stats.activeIncidents}</Text>
            <Text style={styles.statLabel}>Active Incidents</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="bus-outline" size={24} color={COLORS.success} />
            <Text style={styles.statNumber}>{stats.busesOnTime}/{stats.totalBuses}</Text>
            <Text style={styles.statLabel}>Buses On Time</Text>
            <Text style={[styles.statPercent, { color: COLORS.success }]}>{onTimePercentage}%</Text>
          </View>
        </View>
        
        {/* Delays by Route - Bar Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Delays by Route</Text>
          {Object.entries(stats.delaysByRoute).length === 0 ? (
            <Text style={styles.noDataText}>No delay data yet</Text>
          ) : (
            Object.entries(stats.delaysByRoute).map(([routeId, count]) => {
              const route = ROUTES[routeId];
              const maxCount = Math.max(...Object.values(stats.delaysByRoute), 1);
              const widthPercent = (count / maxCount) * 100;
              return (
                <View key={routeId} style={styles.barRow}>
                  <Text style={styles.barLabel}>{route?.name || routeId}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${widthPercent}%`, backgroundColor: route?.color || COLORS.primary }]} />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              );
            })
          )}
        </View>
        
        {/* Most Common Delay Reasons */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Most Common Delay Reasons</Text>
          {Object.entries(stats.delayReasons).length === 0 ? (
            <Text style={styles.noDataText}>No delay data yet</Text>
          ) : (
            Object.entries(stats.delayReasons)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([reason, count]) => {
                const maxCount = Math.max(...Object.values(stats.delayReasons), 1);
                const widthPercent = (count / maxCount) * 100;
                return (
                  <View key={reason} style={styles.barRow}>
                    <Text style={styles.barLabel}>{getReasonLabel(reason)}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${widthPercent}%`, backgroundColor: COLORS.warning }]} />
                    </View>
                    <Text style={styles.barCount}>{count}</Text>
                  </View>
                );
              })
          )}
        </View>
        
        {/* Recent Delays */}
        <View style={styles.recentCard}>
          <Text style={styles.chartTitle}>Recent Delays</Text>
          {stats.recentDelays.length === 0 ? (
            <Text style={styles.noDataText}>No recent delays</Text>
          ) : (
            stats.recentDelays.map((delay, idx) => (
              <View key={idx} style={styles.recentItem}>
                <View style={styles.recentHeader}>
                  <Text style={styles.recentRoute}>
                    {delay.routeId?.replace('route_', 'Route ') || 'Unknown'}
                  </Text>
                  <Text style={styles.recentDelay}>{delay.estimatedDelayMinutes} min</Text>
                </View>
                <Text style={styles.recentReason}>{delay.reasonLabel || delay.reason}</Text>
                {delay.driverName && (
                  <Text style={styles.recentDriver}>Driver: {delay.driverName}</Text>
                )}
              </View>
            ))
          )}
        </View>
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
  
  statsGrid: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statNumber: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginTop: 8 },
  statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 4 },
  statPercent: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, marginTop: 2 },
  
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.md },
  
  barRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  barLabel: { width: 100, fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  barTrack: { flex: 1, height: 24, backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.sm, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: RADIUS.sm },
  barCount: { width: 30, fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, textAlign: 'right' },
  
  recentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recentItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  recentRoute: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  recentDelay: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.warning },
  recentReason: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  recentDriver: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  
  noDataText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', padding: SPACING.lg },
});