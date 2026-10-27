// src/navigation/UserTabs.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import JourneyPlannerScreen from '../screens/user/JourneyPlannerScreen';
import LiveTrackingScreen from '../screens/user/LiveTrackingScreen';
import StopLocatorScreen from '../screens/user/StopLocatorScreen';
import NotificationsScreen from '../screens/user/NotificationsScreen';
import UserSettingsScreen from '../screens/user/UserSettingsScreen';
import { COLORS, FONTS } from '../config/constants';

const Tab = createBottomTabNavigator();

export default function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 100,
          paddingBottom: 9,
          paddingTop: 9,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: FONTS.sizes.xs,
          fontWeight: FONTS.weights.medium,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Plan') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Track') {
            iconName = focused ? 'bus' : 'bus-outline';
          } else if (route.name === 'Nearby') {
            iconName = focused ? 'location' : 'location-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={30} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Plan" component={JourneyPlannerScreen} />
      <Tab.Screen name="Track" component={LiveTrackingScreen} />
      <Tab.Screen name="Nearby" component={StopLocatorScreen} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
      <Tab.Screen name="Settings" component={UserSettingsScreen} />
    </Tab.Navigator>
  );
}