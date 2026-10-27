// src/navigation/UserNav.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import UserTabs from './UserTabs';

const Stack = createStackNavigator();

export default function UserNav() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={UserTabs} />
    </Stack.Navigator>
  );
}