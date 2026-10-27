const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // Remove any BOM if present and write as pure UTF-8 without BOM
  const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  fs.writeFileSync(filePath, cleanContent, { encoding: 'utf8' });
  console.log('✓', filePath);
}

// Constants file
write('src/config/constants.js', `export const COLORS = {
  black: '#000000',
  white: '#FFFFFF',
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  border: '#2A2A2A',
  primary: '#00A86B',
  primaryDark: '#008F5A',
  primaryFaded: 'rgba(0, 168, 107, 0.12)',
  success: '#00A86B',
  warning: '#F5A623',
  danger: '#E53935',
  info: '#2196F3',
  textPrimary: '#FFFFFF',
  textSecondary: '#8A8A8A',
  textMuted: '#4A4A4A',
  onTime: '#00A86B',
  delayed: '#F5A623',
  cancelled: '#E53935',
  full: '#9C27B0',
};

export const FONTS = {
  sizes: { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32, display: 40 },
  weights: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const RADIUS = { sm: 6, md: 12, lg: 16, xl: 24, full: 999 };

export const USER_ROLES = { guest: 'guest', user: 'user', driver: 'driver', admin: 'admin' };

export const ROUTE_STATUS = { onTime: 'ON_TIME', delayed: 'DELAYED', cancelled: 'CANCELLED', full: 'FULL' };

export const ALERT_TYPES = { delay: 'DELAY', cancellation: 'CANCELLATION', routeChange: 'ROUTE_CHANGE', fullCapacity: 'FULL_CAPACITY', system: 'SYSTEM' };

export const FARE = { baseRate: 14.00, currency: 'R' };

export const DURBAN_REGION = { latitude: -29.8579, longitude: 31.0218, latitudeDelta: 0.08, longitudeDelta: 0.08 };

export const ROUTE_520_STOPS = [
  { id: 'stop_1', name: 'Woodlands Circle', latitude: -29.89186676754555, longitude: 30.943247885284073, order: 1, landmark: 'Woodlands Shopping Centre' },
  { id: 'stop_2', name: 'Radcliffe Road', latitude: -29.924775199309764, longitude: 30.952013638684868, order: 2, landmark: 'Radcliffe Road & Kenyon Howden Rd' },
  { id: 'stop_3', name: 'Kenyon Howden Road', latitude: -29.922683496184614, longitude: 30.957905138684765, order: 3, landmark: 'Kenyon Howden & Umbilo Road Junction' },
  { id: 'stop_4', name: 'Umbilo Road', latitude: -29.87667003635949, longitude: 30.99059780799635, order: 4, landmark: 'Umbilo Road stop' },
  { id: 'stop_5', name: 'Glenwood', latitude: -29.8734, longitude: 31.0055, order: 5, landmark: 'Berea Road & Glenwood junction' },
  { id: 'stop_6', name: 'Musgrave Centre', latitude: -29.848334033729966, longitude: 30.997932224741515, order: 6, landmark: 'Musgrave Centre Bus Stop' },
  { id: 'stop_7', name: 'Berea Road', latitude: -29.857159159765928, longitude: 31.005599215298382, order: 7, landmark: 'Berea Road heading into CBD' },
  { id: 'stop_8', name: 'West Street', latitude: -29.858035336924047, longitude: 31.026014465536253, order: 8, landmark: 'West Street CBD' },
  { id: 'stop_9', name: 'Pine Street', latitude: -29.8590, longitude: 31.0223, order: 9, landmark: 'Pine Street near City Hall' },
  { id: 'stop_10', name: 'City Terminus', latitude: -29.846134364479312, longitude: 31.025524178633884, order: 10, landmark: 'Durban City Bus Terminus' },
];

export const ROUTE_520_TIMETABLE = {
  weekday: {
    outbound: ['06:00','06:20','06:30','07:00','08:00','09:00','10:00','15:55','16:30'],
    inbound: ['08:15','12:00','15:30','16:10','16:15','16:45','16:55'],
  },
  saturday: {
    outbound: ['07:00','08:30','09:00','14:00'],
    inbound: ['11:30','13:15','14:15','18:10'],
  },
  sunday: {
    outbound: ['07:35','08:30','09:00','13:30','15:00'],
    inbound: ['12:30','14:15','15:45','17:00','18:15'],
  },
};
`);

// AuthContext
write('src/context/AuthContext.js', `import React, { createContext, useContext, useState, useEffect } from 'react';
import { USER_ROLES } from '../config/constants';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(USER_ROLES.guest);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        setUser(null);
        setRole(USER_ROLES.guest);
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const loginAsUser = async (email, password) => {
    try {
      setLoading(true);
      setUser({ email, role: USER_ROLES.user });
      setRole(USER_ROLES.user);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    } finally { setLoading(false); }
  };

  const loginAsDriver = async (email, password) => {
    try {
      setLoading(true);
      setUser({ email, role: USER_ROLES.driver });
      setRole(USER_ROLES.driver);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    } finally { setLoading(false); }
  };

  const loginAsAdmin = async (email, password) => {
    try {
      setLoading(true);
      setUser({ email, role: USER_ROLES.admin });
      setRole(USER_ROLES.admin);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    } finally { setLoading(false); }
  };

  const registerUser = async (email, password, fullName) => {
    try {
      setLoading(true);
      setUser({ email, fullName, role: USER_ROLES.user });
      setRole(USER_ROLES.user);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    } finally { setLoading(false); }
  };

  const logout = async () => {
    setUser(null);
    setRole(USER_ROLES.guest);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, isGuest: role === USER_ROLES.guest, isUser: role === USER_ROLES.user, isDriver: role === USER_ROLES.driver, isAdmin: role === USER_ROLES.admin, loginAsUser, loginAsDriver, loginAsAdmin, registerUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
`);

// AppContext
write('src/context/AppContext.js', `import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
};

export const AppProvider = ({ children }) => {
  const [routes, setRoutes] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  const [appLoading, setAppLoading] = useState(false);

  const updateRoutes = useCallback((r) => setRoutes(r), []);
  const addAlert = useCallback((a) => setActiveAlerts((prev) => [a, ...prev]), []);
  const clearAlerts = useCallback(() => setActiveAlerts([]), []);
  const selectRoute = useCallback((r) => setSelectedRoute(r), []);
  const updateUserLocation = useCallback((l) => setUserLocation(l), []);
  const reportIncident = useCallback((i) => setActiveIncident(i), []);
  const clearIncident = useCallback(() => setActiveIncident(null), []);

  return (
    <AppContext.Provider value={{ routes, activeAlerts, selectedRoute, userLocation, activeIncident, appLoading, setAppLoading, updateRoutes, addAlert, clearAlerts, selectRoute, updateUserLocation, reportIncident, clearIncident }}>
      {children}
    </AppContext.Provider>
  );
};
`);

// Navigation files
write('src/navigation/UserNav.js', `import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../config/constants';
export default function UserNav() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary }}>User Flow</Text></View>;
}
`);

write('src/navigation/DriverNav.js', `import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../config/constants';
export default function DriverNav() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary }}>Driver Flow</Text></View>;
}
`);

write('src/navigation/AdminNav.js', `import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../config/constants';
export default function AdminNav() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary }}>Admin Flow</Text></View>;
}
`);

write('src/navigation/AuthNav.js', `import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from '../screens/auth/SplashScreen';
import UserLoginScreen from '../screens/auth/UserLoginScreen';
import UserRegisterScreen from '../screens/auth/UserRegisterScreen';
import DriverLoginScreen from '../screens/auth/DriverLoginScreen';
import AdminLoginScreen from '../screens/auth/AdminLoginScreen';
const Stack = createStackNavigator();
export default function AuthNav() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="UserLogin" component={UserLoginScreen} />
      <Stack.Screen name="UserRegister" component={UserRegisterScreen} />
      <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
    </Stack.Navigator>
  );
}
`);

write('src/navigation/index.js', `import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, USER_ROLES } from '../config/constants';
import UserNav from './UserNav';
import DriverNav from './DriverNav';
import AdminNav from './AdminNav';
import AuthNav from './AuthNav';
export default function RootNavigator() {
  const { role, loading } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }
  switch (role) {
    case USER_ROLES.user: return <UserNav />;
    case USER_ROLES.driver: return <DriverNav />;
    case USER_ROLES.admin: return <AdminNav />;
    default: return <AuthNav />;
  }
}
`);

// Screen files
write('src/screens/auth/SplashScreen.js', `import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../config/constants';
export default function SplashScreen() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' }}>BusTrack</Text><Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>Real-time bus intelligence</Text></View>;
}
`);

write('src/screens/auth/UserLoginScreen.js', `import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../config/constants';
export default function UserLoginScreen() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary }}>User Login</Text></View>;
}
`);

write('src/screens/auth/UserRegisterScreen.js', `import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../config/constants';
export default function UserRegisterScreen() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary }}>Register</Text></View>;
}
`);

write('src/screens/auth/DriverLoginScreen.js', `import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../config/constants';
export default function DriverLoginScreen() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary }}>Driver Login</Text></View>;
}
`);

write('src/screens/auth/AdminLoginScreen.js', `import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../config/constants';
export default function AdminLoginScreen() {
  return <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.textPrimary }}>Admin Login</Text></View>;
}
`);

// App.js
write('App.js', `import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import RootNavigator from './src/navigation/index';

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AppProvider>
    </AuthProvider>
  );
}
`);

console.log('\n✅ All files written successfully!');