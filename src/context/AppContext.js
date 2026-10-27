import React, { createContext, useContext, useState, useCallback } from 'react';

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
