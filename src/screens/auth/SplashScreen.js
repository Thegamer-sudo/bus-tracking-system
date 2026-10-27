import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, StatusBar, Dimensions } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../config/constants';

const { height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle='light-content' backgroundColor={COLORS.background} />

      <Animated.View style={[styles.brand, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.logo}>
          <View style={styles.logoDot} />
        </View>
        <Text style={styles.appName}>BusTrack</Text>
        <Text style={styles.tagline}>Real-time bus intelligence</Text>
      </Animated.View>

      <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('UserLogin')} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('DriverLogin')} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>Driver Login</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.guestBtn} onPress={() => navigation.navigate('UserLogin')} activeOpacity={0.7}>
          <Text style={styles.guestBtnText}>Continue without account</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by AI delay prediction</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
    paddingTop: height * 0.18,
    paddingBottom: SPACING.xxl,
  },
  brand: {
    alignItems: 'flex-start',
  },
  logo: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoDot: {
    width: 16,
    height: 16,
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.full,
  },
  appName: {
    fontSize: FONTS.sizes.display,
    fontWeight: FONTS.weights.heavy,
    color: COLORS.textPrimary,
    letterSpacing: -1,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.regular,
    letterSpacing: 0.2,
  },
  actions: {
    gap: SPACING.sm,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: 18,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    letterSpacing: 0.3,
  },
  guestBtn: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  guestBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 0.5,
  },
});