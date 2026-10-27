import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../config/constants';
export default function AdminLoginScreen() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary }}>Admin Login</Text></View>;
}
