// src/screens/user/UserSettingsScreen.js
// User preferences: notifications, alert distance, saved stops, logout

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS, DEFAULT_USER_PREFS } from '../../config/constants';
import { saveUserPrefsLocally, getLocalUserPrefs } from '../../services/offlineService';

export default function UserSettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_USER_PREFS);
  const [savedStops, setSavedStops] = useState([]);

  // Load preferences from Firestore
  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      // Try local cache first
      const cached = await getLocalUserPrefs();
      if (cached) {
        setPrefs(cached);
        setSavedStops(cached.savedStops || []);
      }

      // Then fetch from Firestore
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const firestorePrefs = data.preferences || DEFAULT_USER_PREFS;
          setPrefs(firestorePrefs);
          setSavedStops(firestorePrefs.savedStops || []);
          await saveUserPrefsLocally(firestorePrefs);
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
          preferences: updatedPrefs,
        });
      }
      await saveUserPrefsLocally(updatedPrefs);
    } catch (error) {
      console.error('Failed to save preference:', error);
      Alert.alert('Error', 'Failed to save preference. Please try again.');
      // Revert on error
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.fullName || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.primaryFaded }]}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDesc}>Receive alerts about bus arrivals</Text>
            </View>
          </View>
          <Switch
            value={prefs.notificationsEnabled}
            onValueChange={(val) => updatePreference('notificationsEnabled', val)}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={COLORS.white}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.warningFaded }]}>
              <Ionicons name="bus-outline" size={20} color={COLORS.warning} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Alert When</Text>
              <Text style={styles.settingDesc}>Notify me when bus is this many stops away</Text>
            </View>
          </View>
          <View style={styles.pickerRow}>
            {[1, 2, 3].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.pickerOption,
                  prefs.alertStopsAway === value && styles.pickerOptionActive,
                ]}
                onPress={() => updatePreference('alertStopsAway', value)}
              >
                <Text style={[
                  styles.pickerText,
                  prefs.alertStopsAway === value && styles.pickerTextActive,
                ]}>
                  {value} {value === 1 ? 'stop' : 'stops'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.infoFaded }]}>
              <Ionicons name="volume-high-outline" size={20} color={COLORS.info} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Sound Alerts</Text>
              <Text style={styles.settingDesc}>Play sound when notification arrives</Text>
            </View>
          </View>
          <Switch
            value={prefs.soundEnabled}
            onValueChange={(val) => updatePreference('soundEnabled', val)}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={COLORS.white}
            disabled={saving}
          />
        </View>
      </View>

      {/* App Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        
        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('StopLocator')}>
          <View style={styles.menuLeft}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.purpleFaded }]}>
              <Ionicons name="location-outline" size={20} color={COLORS.purple} />
            </View>
            <Text style={styles.menuLabel}>Find Nearest Stop</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.menuLeft}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.infoFaded }]}>
              <Ionicons name="notifications-circle-outline" size={20} color={COLORS.info} />
            </View>
            <Text style={styles.menuLabel}>Notification History</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.infoCard}>
          <Text style={styles.versionText}>BusTrack v2.0.0</Text>
          <Text style={styles.copyrightText}>© 2024 BusTrack. All rights reserved.</Text>
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
  
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  settingDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  
  pickerRow: { flexDirection: 'row', gap: SPACING.xs },
  pickerOption: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  pickerOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaded },
  pickerText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  pickerTextActive: { color: COLORS.primary, fontWeight: FONTS.weights.bold },
  
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  menuLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textPrimary },
  
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  versionText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  copyrightText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginTop: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.danger, backgroundColor: COLORS.dangerFaded },
  logoutText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium, color: COLORS.danger },
});