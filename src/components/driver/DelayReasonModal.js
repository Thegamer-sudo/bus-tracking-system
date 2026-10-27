// src/components/driver/DelayReasonModal.js
//
// Modal that appears when a driver taps "Delayed".
// Collects: reason (from DELAY_REASONS), estimated delay in minutes,
// and an optional short note. Writes to both buses/ and delays/ in Firestore.

import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  COLORS, FONTS, SPACING, RADIUS, DELAY_REASONS,
} from '../../config/constants';

const DELAY_MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45];

export default function DelayReasonModal({
  visible,
  onClose,
  onConfirm,       // (reasonKey, estimatedMinutes, note) => void  — called after Firestore write
  routeId,
  busId,
  driverUid,
  driverName,
  currentStopIndex,
  currentStopName,
}) {
  const [selectedReason, setSelectedReason]   = useState(null);
  const [selectedMinutes, setSelectedMinutes] = useState(10);
  const [note, setNote]                       = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState('');

  const resetAndClose = () => {
    setSelectedReason(null);
    setSelectedMinutes(10);
    setNote('');
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedReason) {
      setError('Please select a reason for the delay.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const reasonObj = DELAY_REASONS.find(r => r.key === selectedReason);

      // Write to delays collection — read by admin + user LiveTracking screens
      await addDoc(collection(db, 'delays'), {
        routeId,
        busId,
        driverUid:              driverUid || 'unknown',
        driverName:             driverName || 'Driver',
        reason:                 selectedReason,
        reasonLabel:            reasonObj?.label || selectedReason,
        customNote:             note.trim(),
        estimatedDelayMinutes:  selectedMinutes,
        stopIndex:              currentStopIndex ?? 0,
        stopName:               currentStopName  || 'En route',
        status:                 'ACTIVE',
        timestamp:              serverTimestamp(),
        resolvedAt:             null,
      });

      onConfirm(selectedReason, selectedMinutes, note.trim());
      resetAndClose();
    } catch (e) {
      setError('Failed to submit. Please try again.');
      console.error('[DelayModal] Firestore write failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* ── Header ───────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="warning" size={22} color={COLORS.warning} />
              </View>
              <View>
                <Text style={styles.title}>Report Delay</Text>
                <Text style={styles.subtitle}>
                  {currentStopName ? `Near ${currentStopName}` : 'En route'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={resetAndClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>

            {/* ── Reason picker ────────────────────────────────────── */}
            <Text style={styles.sectionLabel}>What is causing the delay?</Text>
            <View style={styles.reasonGrid}>
              {DELAY_REASONS.map((reason) => {
                const active = selectedReason === reason.key;
                return (
                  <TouchableOpacity
                    key={reason.key}
                    style={[
                      styles.reasonCard,
                      active && { borderColor: reason.color, backgroundColor: reason.color + '18' },
                    ]}
                    onPress={() => { setSelectedReason(reason.key); setError(''); }}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.reasonIcon,
                      active && { backgroundColor: reason.color + '30' },
                    ]}>
                      <Ionicons
                        name={reason.icon}
                        size={20}
                        color={active ? reason.color : COLORS.textSecondary}
                      />
                    </View>
                    <Text style={[
                      styles.reasonLabel,
                      active && { color: reason.color, fontWeight: FONTS.weights.semibold },
                    ]}>
                      {reason.label}
                    </Text>
                    {active && (
                      <View style={[styles.checkDot, { backgroundColor: reason.color }]}>
                        <Ionicons name="checkmark" size={10} color={COLORS.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Estimated delay ──────────────────────────────────── */}
            <Text style={styles.sectionLabel}>Estimated delay</Text>
            <View style={styles.minuteRow}>
              {DELAY_MINUTE_OPTIONS.map((min) => {
                const active = selectedMinutes === min;
                return (
                  <TouchableOpacity
                    key={min}
                    style={[styles.minuteChip, active && styles.minuteChipActive]}
                    onPress={() => setSelectedMinutes(min)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.minuteText, active && styles.minuteTextActive]}>
                      {min} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Optional note ────────────────────────────────────── */}
            <Text style={styles.sectionLabel}>Add a note <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Accident blocking left lane on Umbilo Rd..."
              placeholderTextColor={COLORS.textMuted}
              value={note}
              onChangeText={setNote}
              maxLength={120}
              multiline
              numberOfLines={2}
            />
            <Text style={styles.charCount}>{note.length}/120</Text>

            {/* ── Error ────────────────────────────────────────────── */}
            {!!error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* ── Actions ──────────────────────────────────────────── */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose} disabled={submitting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
                onPress={handleConfirm}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color={COLORS.white} />
                    <Text style={styles.confirmText}>Report Delay</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Bottom breathing room */}
            <View style={{ height: SPACING.xl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    maxHeight: '90%',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.warningFaded,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Section labels
  sectionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: {
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.regular,
    textTransform: 'none',
  },

  // Reason grid — 2 columns
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  reasonCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    paddingVertical: 12,
    position: 'relative',
  },
  reasonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textPrimary,
    flex: 1,
    flexWrap: 'wrap',
  },
  checkDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Minute chips
  minuteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  minuteChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
  },
  minuteChipActive: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warningFaded,
  },
  minuteText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  minuteTextActive: {
    color: COLORS.warning,
    fontWeight: FONTS.weights.bold,
  },

  // Note input
  noteInput: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    padding: SPACING.md,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },

  // Error
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.dangerFaded,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
  },
  errorText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.danger,
    flex: 1,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 15,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning,
    gap: SPACING.sm,
  },
  confirmText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
});