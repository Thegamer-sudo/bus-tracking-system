// src/screens/driver/DriverSettingsScreen.js
// Driver preferences: sound alerts, auto-suggest delay, offline mode

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS, DEFAULT_DRIVER_PREFS, ROUTES } from '../../config/constants';
import { saveDriverPrefsLocally, getLocalDriverPrefs, cacheRouteData } from '../../services/offlineService';

export default function DriverSettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_DRIVER_PREFS);
  const [routeInfo, setRouteInfo] = useState(null);

  // Load preferences from Firestore
  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      // Try local cache first
      const cached = await getLocalDriverPrefs();
      if (cached) setPrefs(cached);

      // Then fetch from Firestore
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const firestorePrefs = data.driverPreferences || DEFAULT_DRIVER_PREFS;
          setPrefs(firestorePrefs);
          await saveDriverPrefsLocally(firestorePrefs);
        }
        
        // Get route info
        const assignedRoute = user?.assignedRoute || data?.assignedRoute || 'route_520';
        const routeData = ROUTES[assignedRoute];
        if (routeData) {
          setRouteInfo({
            name: routeData.name,
            description: routeData.description,
            busLabel: routeData.busLabel,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key, value) => {
    setSaving(true);
    const updatedPrefs = { ...prefs, [key]: value };
    setPrefs(updatedPrefs);

    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          driverPreferences: updatedPrefs,
        });
      }
      await saveDriverPrefsLocally(updatedPrefs);
    } catch (error) {
      console.error('Failed to save preference:', error);
      Alert.alert('Error', 'Failed to save preference. Please try again.');
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const handleCacheOffline = async () => {
    Alert.alert(
      'Cache Route Data',
      'This will download route data for offline use. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Cache', 
          onPress: async () => {
            await cacheRouteData();
            Alert.alert('Success', 'Route data cached for offline use!');
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Driver Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'D'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.fullName || 'Driver'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {routeInfo && (
              <View style={styles.routeBadge}>
                <Text style={styles.routeBadgeText}>{routeInfo.name} · {routeInfo.busLabel}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.infoFaded }]}>
              <Ionicons name="volume-high-outline" size={20} color={COLORS.info} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Sound Alerts</Text>
              <Text style={styles.settingDesc}>Play sound for notifications and alerts</Text>
            </View>
          </View>
          <Switch
            value={prefs.soundAlertsEnabled}
            onValueChange={(val) => updatePreference('soundAlertsEnabled', val)}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={COLORS.white}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.warningFaded }]}>
              <Ionicons name="car-outline" size={20} color={COLORS.warning} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Auto-suggest Delay</Text>
              <Text style={styles.settingDesc}>Show banner when entering heavy traffic</Text>
            </View>
          </View>
          <Switch
            value={prefs.autoSuggestDelay}
            onValueChange={(val) => updatePreference('autoSuggestDelay', val)}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={COLORS.white}
            disabled={saving}
          />
        </View>
      </View>

      {/* Offline Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Offline Mode</Text>
        
        <TouchableOpacity style={styles.menuRow} onPress={handleCacheOffline}>
          <View style={styles.menuLeft}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.purpleFaded }]}>
              <Ionicons name="download-outline" size={20} color={COLORS.purple} />
            </View>
            <View>
              <Text style={styles.menuLabel}>Cache Route Data</Text>
              <Text style={styles.menuDesc}>Download route and timetable for offline use</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.infoCard}>
          <Text style={styles.versionText}>BusTrack Driver v2.0.0</Text>
          <Text style={styles.copyrightText}>© 2024 BusTrack. Driver Dashboard</Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.md },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: 56, paddingBottom: SPACING.md },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.heavy, color: COLORS.textPrimary },
  
  section: { marginTop: SPACING.lg, paddingHorizontal: SPACING.lg },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryFaded, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: FONTS.weights.bold, color: COLORS.primary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  profileEmail: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  routeBadge: { marginTop: 6, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryFaded, alignSelf: 'flex-start' },
  routeBadgeText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: FONTS.weights.medium },
  
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  settingDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  menuLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textPrimary },
  menuDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  versionText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  copyrightText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginTop: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.danger, backgroundColor: COLORS.dangerFaded },
  logoutText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium, color: COLORS.danger },
});