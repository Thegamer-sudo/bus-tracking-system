// App.web.js - Simplified web app (Admin Dashboard only)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import AdminDashboard from './src/screens/admin/AdminDashboard';

export default function AppWeb() {
  return (
    <AuthProvider>
      <AppProvider>
        <NavigationContainer>
          <AdminDashboard />
        </NavigationContainer>
      </AppProvider>
    </AuthProvider>
  );
}