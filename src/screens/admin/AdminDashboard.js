// src/screens/admin/AdminDashboard.js - Simple tab switcher (no external deps)
// Admin dashboard with 4 tabs using simple button navigation

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { listenToAllBuses } from '../../services/routeService';
import { COLORS, FONTS, SPACING, RADIUS, ROUTES } from '../../config/constants';
import DelayReportsScreen from './DelayReportsScreen';
import AnalyticsScreen from './AnalyticsScreen';
import BusChangesScreen from './BusChangesScreen';

// Live Overview Tab - Web-friendly (no map)
function LiveOverviewTab() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = listenToAllBuses((allBuses) => {
      const enriched = allBuses.map(bus => {
        const route = Object.values(ROUTES).find(r => r.busId === bus.id);
        return {
          ...bus,
          routeName: route?.name || 'Unknown',
          routeColor: route?.color || COLORS.textMuted,
          routeDescription: route?.description || '',
        };
      });
      setBuses(enriched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading buses...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Live Bus Status</Text>
      <Text style={styles.sectionSubtitle}>Real-time bus positions from Firebase</Text>

      {buses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="bus-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>No buses active</Text>
          <Text style={styles.emptyStateSubtext}>Drivers need to start their trips</Text>
        </View>
      ) : (
        buses.map((bus) => (
          <View key={bus.id} style={[styles.busCard, { borderLeftColor: bus.routeColor, borderLeftWidth: 4 }]}>
            <View style={styles.busCardHeader}>
              <Text style={[styles.busName, { color: bus.routeColor }]}>{bus.routeName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: bus.status === 'ON_TIME' ? COLORS.success + '20' : COLORS.warning + '20' }]}>
                <Text style={[styles.statusText, { color: bus.status === 'ON_TIME' ? COLORS.success : COLORS.warning }]}>
                  {bus.status === 'ON_TIME' ? 'On Time' : bus.status === 'DELAYED' ? 'Delayed' : bus.status}
                </Text>
              </View>
            </View>
            
            <View style={styles.busCardBody}>
              <View style={styles.busInfoRow}>
                <Text style={styles.busInfoLabel}>Bus ID:</Text>
                <Text style={styles.busInfoValue}>{bus.id}</Text>
              </View>
              
              <View style={styles.busInfoRow}>
                <Text style={styles.busInfoLabel}>Direction:</Text>
                <Text style={styles.busInfoValue}>{bus.direction || 'outbound'}</Text>
              </View>
              
              <View style={styles.busInfoRow}>
                <Text style={styles.busInfoLabel}>Stop Index:</Text>
                <Text style={styles.busInfoValue}>{bus.currentStopIndex}</Text>
              </View>
              
              {bus.latitude && bus.longitude && (
                <View style={styles.busInfoRow}>
                  <Text style={styles.busInfoLabel}>Position:</Text>
                  <Text style={styles.busInfoValue}>{bus.latitude.toFixed(4)}, {bus.longitude.toFixed(4)}</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Main Admin Dashboard Component
export default function AdminDashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { name: 'Live', icon: 'radio-outline', component: LiveOverviewTab },
    { name: 'Delays', icon: 'warning-outline', component: DelayReportsScreen },
    { name: 'Analytics', icon: 'bar-chart-outline', component: AnalyticsScreen },
    { name: 'Bus Changes', icon: 'swap-horizontal-outline', component: BusChangesScreen },
  ];

  const ActiveComponent = tabs[activeTab].component;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>Bus Operations Center</Text>
        </View>
        <TouchableOpacity style={styles.exitBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar - Simple buttons, no external dependencies */}
      <View style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.tab, activeTab === index && styles.activeTab]}
            onPress={() => setActiveTab(index)}
          >
            <Ionicons 
              name={tab.icon} 
              size={18} 
              color={activeTab === index ? COLORS.primary : COLORS.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ActiveComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  headerSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exitText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
  },

  // Tab Content
  tabContent: { flex: 1, padding: SPACING.lg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.md },
  sectionTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: 4 },
  sectionSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  
  emptyState: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyStateText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  emptyStateSubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center' },
  
  busCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  busCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  busName: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold },
  busCardBody: { padding: SPACING.md },
  busInfoRow: { flexDirection: 'row', marginBottom: SPACING.xs },
  busInfoLabel: { width: 80, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  busInfoValue: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, fontWeight: FONTS.weights.medium },
});