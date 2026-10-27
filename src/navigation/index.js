// src/navigation/index.js
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AuthNav from './AuthNav';
import UserNav from './UserNav';
import DriverNav from './DriverNav';
import AdminNav from './AdminNav';
import { COLORS } from '../config/constants';

export default function RootNavigator() {
  const { user, role, loading } = useAuth();  // ← CHANGE: userRole → role

  console.log('🔍 RootNavigator - user:', user?.email);
  console.log('🔍 RootNavigator - role:', role);  // ← CHANGE: userRole → role
  console.log('🔍 RootNavigator - loading:', loading);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    console.log('➡️ No user, showing AuthNav');
    return <AuthNav />;
  }

  if (role === 'admin') {
    console.log('➡️ Admin user, showing AdminNav');
    return <AdminNav />;
  }

  if (role === 'driver') {
    console.log('➡️ Driver user, showing DriverNav');
    return <DriverNav />;
  }

  console.log('➡️ Regular user, showing UserNav');
  return <UserNav />;
}