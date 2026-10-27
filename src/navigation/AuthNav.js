// src/navigation/AuthNav.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import UserLoginScreen from '../screens/auth/UserLoginScreen';
import UserRegisterScreen from '../screens/auth/UserRegisterScreen';
import DriverLoginScreen from '../screens/auth/DriverLoginScreen';
import AdminLoginScreen from '../screens/auth/AdminLoginScreen';

const Stack = createStackNavigator();

export default function AuthNav() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UserLogin" component={UserLoginScreen} />
      <Stack.Screen name="UserRegister" component={UserRegisterScreen} />
      <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
    </Stack.Navigator>
  );
}