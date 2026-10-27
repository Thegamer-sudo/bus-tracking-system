// src/screens/user/NotificationsScreen.js
// Updated to read delays directly from Firestore

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../config/constants';
import { getLocalNotifications, clearLocalNotifications, logNotificationLocally } from '../../services/offlineService';

// Icon and colour per notification type
function getMeta(type) {
  switch (type) {
    case 'approaching':  return { icon: 'bus-outline',            color: COLORS.warning };
    case 'almost_here':  return { icon: 'alert-circle-outline',   color: COLORS.warning };
    case 'arrived':      return { icon: 'checkmark-circle-outline',color: COLORS.success };
    case 'BUS_CHANGE':   return { icon: 'swap-horizontal-outline', color: COLORS.info    };
    case 'delay':        return { icon: 'time-outline',            color: COLORS.warning };
    case 'incident':     return { icon: 'warning-outline',         color: COLORS.danger  };
    default:             return { icon: 'notifications-outline',   color: COLORS.primary };
  }
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [delays, setDelays] = useState([]);

  // Load delays directly from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'delays'),
      where('status', '==', 'ACTIVE'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const delayList = snapshot.docs.map(doc => ({
        id: doc.id,
        title: `⚠️ Delay on ${doc.data().routeId?.replace('route_', 'Route ') || 'Bus'}`,
        body: `${doc.data().reasonLabel || doc.data().reason}: ${doc.data().estimatedDelayMinutes} min delay`,
        type: 'delay',
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      }));
      setDelays(delayList);
      
      // Also save to local storage
      delayList.forEach(delay => {
        logNotificationLocally(delay).catch(console.warn);
      });
      
      setLoading(false);
    }, (error) => {
      console.warn('Delay fetch error:', error.message);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Also load from local storage
  const loadLocalNotifications = async () => {
    const saved = await getLocalNotifications();
    // Merge and deduplicate
    const all = [...delays, ...saved];
    const unique = all.filter((item, index, self) => 
      index === self.findIndex(i => i.title === item.title && i.timestamp === item.timestamp)
    );
    unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setNotifications(unique);
  };

  useFocusEffect(
    useCallback(() => {
      loadLocalNotifications();
    }, [delays]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLocalNotifications();
    setRefreshing(false);
  };

  const handleClearAll = async () => {
    await clearLocalNotifications();
    setNotifications(delays); // Keep Firestore ones
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
          <Text style={styles.title}>Notifications</Text>
        </View>
        {notifications.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
            <Text style={styles.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={notifications.length === 0 ? styles.emptyWrap : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={48} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              You'll see alerts here when your bus is approaching, arrives, or there's a delay on your route.
            </Text>
          </View>
        ) : (
          notifications.map((notif, index) => {
            const meta = getMeta(notif.type);
            return (
              <View key={index} style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: meta.color + '20' }]}>
                  <Ionicons name={meta.icon} size={22} color={meta.color} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{notif.title}</Text>
                  <Text style={styles.cardMessage}>{notif.body}</Text>
                  <Text style={styles.cardTime}>{formatTime(notif.timestamp)}</Text>
                </View>
                <View style={[styles.typePill, { backgroundColor: meta.color + '20' }]}>
                  <View style={[styles.typeDot, { backgroundColor: meta.color }]} />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingTop:       56,
    paddingHorizontal:SPACING.lg,
    paddingBottom:    SPACING.md,
    backgroundColor:  COLORS.background,
    borderBottomWidth:1,
    borderBottomColor:COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title:      { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  clearBtn:   { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  clearBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  list:      { flex: 1, paddingTop: SPACING.sm },
  emptyWrap: { flex: 1 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: 80 },
  emptyIconWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  emptyTitle:     { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle:  { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom:     SPACING.sm,
    borderRadius:     RADIUS.md,
    padding:          SPACING.md,
    borderWidth:      1,
    borderColor:      COLORS.border,
    gap:              SPACING.md,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardBody: { flex: 1 },
  cardTitle:   { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, marginBottom: 2 },
  cardMessage: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: 4, lineHeight: 16 },
  cardTime:    { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  typePill: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  typeDot:  { width: 8, height: 8, borderRadius: 4 },
});