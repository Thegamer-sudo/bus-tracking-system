import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../config/constants';

export default function RouteDetailScreen({ route }) {
  const stop = route?.params?.stop || null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="bus-outline" size={28} color={COLORS.primary} />
        <Text style={styles.title}>Stop Details</Text>
      </View>

      <ScrollView style={styles.content}>
        {stop ? (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.stopName}>{stop.name}</Text>
              <Text style={styles.stopLandmark}>{stop.landmark}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Stop Information</Text>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>Stop {stop.order} on Route 520</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="navigate-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>
                  Coordinates: {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Nearby Places</Text>
              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>{stop.landmark}</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.placeholderCard}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.placeholderText}>No stop information available</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  title: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  content: { flex: 1, padding: SPACING.lg },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  stopName: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  stopLandmark: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, marginBottom: SPACING.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  infoText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, flex: 1 },
  placeholderCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.xxl, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
  placeholderText: { fontSize: FONTS.sizes.md, color: COLORS.textMuted, textAlign: 'center' },
});