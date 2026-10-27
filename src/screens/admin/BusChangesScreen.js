// src/screens/admin/BusChangesScreen.js
// View bus change history and create new bus change events

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS, ROUTES, BUS_CHANGE_REASONS } from '../../config/constants';

export default function BusChangesScreen() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [newBusLabel, setNewBusLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'bus_changes'),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const changeList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChanges(changeList);
      setLoading(false);
    }, (error) => {
      console.error('Error loading bus changes:', error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleCreateBusChange = async () => {
    if (!selectedRoute) {
      Alert.alert('Missing Info', 'Please select a route');
      return;
    }
    if (!selectedReason) {
      Alert.alert('Missing Info', 'Please select a reason');
      return;
    }
    if (!newBusLabel.trim()) {
      Alert.alert('Missing Info', 'Please enter the new bus label');
      return;
    }
    
    setSubmitting(true);
    try {
      const routeData = ROUTES[selectedRoute];
      await addDoc(collection(db, 'bus_changes'), {
        routeId: selectedRoute,
        routeName: routeData?.name || selectedRoute,
        oldBusId: routeData?.busId || 'unknown',
        newBusId: `${selectedRoute}_replacement`,
        oldBusLabel: routeData?.busLabel || routeData?.busId || 'Unknown',
        newBusLabel: newBusLabel.trim().toUpperCase(),
        reason: selectedReason,
        reasonLabel: BUS_CHANGE_REASONS.find(r => r.key === selectedReason)?.label || selectedReason,
        boardingStop: 'City Terminus',
        boardingStopIdx: 0,
        createdBy: 'admin',
        createdByName: 'Admin',
        isActive: true,
        timestamp: serverTimestamp(),
        resolvedAt: null,
      });
      
      setShowModal(false);
      setSelectedRoute('');
      setSelectedReason('');
      setNewBusLabel('');
      Alert.alert('Success', 'Bus change event created successfully');
    } catch (error) {
      console.error('Error creating bus change:', error);
      Alert.alert('Error', 'Failed to create bus change');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return 'Unknown';
    return timestamp.toDate().toLocaleString();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading bus changes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Create Button */}
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Bus Change Log</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.createBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {changes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="swap-horizontal-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyStateText}>No bus changes logged</Text>
            <Text style={styles.emptyStateSubtext}>Tap "New" to create a bus change event</Text>
          </View>
        ) : (
          changes.map((change) => (
            <View key={change.id} style={styles.changeCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.routeBadge, { backgroundColor: change.isActive ? COLORS.warningFaded : COLORS.successFaded }]}>
                  <Text style={[styles.routeBadgeText, { color: change.isActive ? COLORS.warning : COLORS.success }]}>
                    {change.isActive ? 'ACTIVE' : 'RESOLVED'}
                  </Text>
                </View>
                <Text style={styles.timestamp}>{formatTime(change.timestamp)}</Text>
              </View>
              
              <Text style={styles.routeName}>{change.routeName}</Text>
              
              <View style={styles.busChangeRow}>
                <View style={styles.oldBus}>
                  <Text style={styles.busLabel}>{change.oldBusLabel}</Text>
                  <Text style={styles.busSubtext}>Old Bus</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={COLORS.textSecondary} />
                <View style={styles.newBus}>
                  <Text style={styles.busLabel}>{change.newBusLabel}</Text>
                  <Text style={styles.busSubtext}>New Bus</Text>
                </View>
              </View>
              
              <Text style={styles.reason}>
                <Text style={styles.label}>Reason:</Text> {change.reasonLabel}
              </Text>
              
              <Text style={styles.boardingStop}>
                <Text style={styles.label}>Board at:</Text> {change.boardingStop}
              </Text>
              
              <Text style={styles.createdBy}>
                <Text style={styles.label}>Created by:</Text> {change.createdByName}
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Bus Change Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Ionicons name="swap-horizontal" size={22} color={COLORS.info} />
              <Text style={styles.modalTitle}>Create Bus Change</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Select Route</Text>
            <View style={styles.routePicker}>
              {Object.entries(ROUTES).map(([routeId, route]) => (
                <TouchableOpacity
                  key={routeId}
                  style={[
                    styles.routeOption,
                    selectedRoute === routeId && { backgroundColor: route.color + '20', borderColor: route.color }
                  ]}
                  onPress={() => setSelectedRoute(routeId)}
                >
                  <Text style={[styles.routeOptionText, selectedRoute === routeId && { color: route.color }]}>
                    {route.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>New Bus Label</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. BT-520B"
              placeholderTextColor={COLORS.textMuted}
              value={newBusLabel}
              onChangeText={setNewBusLabel}
              autoCapitalize="characters"
              maxLength={12}
            />

            <Text style={styles.modalLabel}>Reason</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reasonScroll}>
              {BUS_CHANGE_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.key}
                  style={[
                    styles.reasonChip,
                    selectedReason === reason.key && { backgroundColor: COLORS.info, borderColor: COLORS.info }
                  ]}
                  onPress={() => setSelectedReason(reason.key)}
                >
                  <Text style={[styles.reasonChipText, selectedReason === reason.key && { color: COLORS.white }]}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreateBusChange}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color={COLORS.white} />
                    <Text style={styles.submitText}>Create Change</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Add TextInput import at top
import { TextInput } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.md },
  scrollView: { flex: 1 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg },
  sectionTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.info, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.md },
  createBtnText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  
  emptyState: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyStateText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  emptyStateSubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center' },
  
  changeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  routeBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  routeBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  timestamp: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  routeName: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.md },
  
  busChangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  oldBus: { alignItems: 'center', flex: 1 },
  newBus: { alignItems: 'center', flex: 1 },
  busLabel: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  busSubtext: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  
  reason: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, marginBottom: 4 },
  boardingStop: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, marginBottom: 4 },
  createdBy: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 4 },
  label: { color: COLORS.textSecondary },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, flex: 1, marginLeft: SPACING.sm },
  modalClose: { padding: 4 },
  
  modalLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.md },
  routePicker: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  routeOption: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  routeOptionText: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary },
  
  textInput: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    padding: SPACING.md,
  },
  
  reasonScroll: { flexDirection: 'row', marginBottom: SPACING.md },
  reasonChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated, marginRight: SPACING.sm },
  reasonChipText: { fontSize: FONTS.sizes.xs, color: COLORS.textPrimary },
  
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn: { flex: 1, backgroundColor: COLORS.surfaceElevated, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  submitBtn: { flex: 2, flexDirection: 'row', backgroundColor: COLORS.info, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  submitText: { color: COLORS.white, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },
});