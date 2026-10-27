import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../../config/constants';

export default function StopMarker({ number, isSelected, isCurrent, isBlocked, isSkipped, size = 'normal' }) {
  const bg = isBlocked  ? COLORS.danger   :
             isSkipped  ? COLORS.warning   :
             isSelected ? COLORS.warning   :
             isCurrent  ? COLORS.primary   :
             COLORS.surface;

  const border = isBlocked  ? COLORS.danger   :
                 isSkipped  ? COLORS.warning   :
                 isSelected ? COLORS.warning   :
                 COLORS.primary;

  const textColor = (isSelected || isCurrent || isBlocked || isSkipped)
    ? COLORS.white
    : COLORS.primary;

  const dim = size === 'small' ? 24 : 32;
  const fontSize = size === 'small' ? 9 : 11;

  return (
    <View style={[
      styles.marker,
      { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg, borderColor: border }
    ]}>
      <Text style={[styles.number, { fontSize, color: textColor }]}>{number}</Text>
      {isCurrent && <View style={styles.pulse} />}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  number: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  pulse: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: COLORS.primary,
    opacity: 0.4,
  },
});