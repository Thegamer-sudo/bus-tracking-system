// src/navigation/DriverNav.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import DriverDashboard from '../screens/driver/DriverDashboard';
import DriverSettingsScreen from '../screens/driver/DriverSettingsScreen';

const Stack = createStackNavigator();

export default function DriverNav() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverDashboard" component={DriverDashboard} />
      <Stack.Screen name="DriverSettings" component={DriverSettingsScreen} />
    </Stack.Navigator>
  );
}