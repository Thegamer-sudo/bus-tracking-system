// src/screens/auth/DriverLoginScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../config/constants';
import { loginWithEmail, logoutUser } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

const getFriendlyError = (code) => {
  switch (code) {
    case 'auth/invalid-email':         return 'Please enter a valid email address.';
    case 'auth/user-not-found':        return 'No driver account found with this email.';
    case 'auth/wrong-password':        return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':    return 'Incorrect email or password.';
    case 'auth/too-many-requests':     return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':return 'No internet connection. Please check your network.';
    default:                           return 'Something went wrong. Please try again.';
  }
};

export default function DriverLoginScreen({ navigation }) {
  const { setUserAndRole } = useAuth();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [emailError, setEmailError]   = useState('');
  const [passError, setPassError]     = useState('');

  const validate = () => {
    let ok = true;
    setEmailError('');
    setPassError('');
    if (!email.trim()) { setEmailError('Email is required.'); ok = false; }
    if (!password)     { setPassError('Password is required.'); ok = false; }
    return ok;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    const result = await loginWithEmail(email.trim().toLowerCase(), password);
    setLoading(false);

    if (result.success) {
      if (result.user.role === 'driver') {
        setUserAndRole(result.user, result.user.role);
        // RootNavigator switches automatically based on role
      } else {
        Alert.alert(
          'Access Denied',
          'This account is not registered as a driver. Please use the passenger login.',
          [{ text: 'OK' }],
        );
        await logoutUser();
      }
    } else {
      Alert.alert('Login Failed', getFriendlyError(result.message));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.inner}>

        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back-outline" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Icon badge */}
        <View style={styles.iconBadge}>
          <Ionicons name="bus" size={32} color={COLORS.primary} />
        </View>

        {/* Headings */}
        <Text style={styles.title}>Driver Login</Text>
        <Text style={styles.subtitle}>Sign in to start your route</Text>

        {/* Form */}
        <View style={styles.form}>

          {/* Email */}
          <View style={styles.fieldWrap}>
            <View style={[styles.inputContainer, emailError ? styles.inputError : null]}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Driver email"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(''); }}
              />
            </View>
            {!!emailError && (
              <Text style={styles.fieldError}>{emailError}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <View style={[styles.inputContainer, passError ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                value={password}
                onChangeText={(v) => { setPassword(v); setPassError(''); }}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
            {!!passError && (
              <Text style={styles.fieldError}>{passError}</Text>
            )}
          </View>

          {/* Sign in button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : (
                  <View style={styles.loginBtnInner}>
                    <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
                    <Text style={styles.loginBtnText}>Sign In as Driver</Text>
                  </View>
                )
            }
          </TouchableOpacity>
        </View>

        {/* Info note */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            Driver accounts are created by your transport administrator. Contact support if you cannot access your account.
          </Text>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.xl,
  },

  // Back
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },

  // Icon badge
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryFaded,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },

  // Headings
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.heavy,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },

  // Form
  form: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  fieldWrap: {
    gap: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerFaded,
  },
  inputIcon: {
    paddingLeft: SPACING.md,
  },
  input: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 16,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
  },
  eyeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  fieldError: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.danger,
    paddingLeft: SPACING.sm,
  },

  // Login button
  loginBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
  },

  // Info note
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});