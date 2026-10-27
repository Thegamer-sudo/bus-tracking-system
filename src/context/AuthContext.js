import React, { createContext, useContext, useState, useEffect } from 'react';
import { USER_ROLES } from '../config/constants';
import { onAuthChange, getCurrentUserData, logoutUser } from '../services/authService';

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
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      console.log('Auth state changed - Firebase user:', firebaseUser?.email);
      
      if (firebaseUser && firebaseUser.uid) {
        // User is logged into Firebase
        const result = await getCurrentUserData(firebaseUser.uid);
        if (result.success) {
          console.log('User data loaded from Firestore:', result.user);
          setUser(result.user);
          setRole(result.user.role);
        } else {
          console.log('User exists in Auth but not in Firestore, using Firebase data');
          setUser(firebaseUser);
          setRole(USER_ROLES.user);
        }
      } else {
        // No user logged in
        console.log('No user logged in, setting to guest');
        setUser(null);
        setRole(USER_ROLES.guest);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setRole(USER_ROLES.guest);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      loading,
      isGuest: role === USER_ROLES.guest,
      isUser: role === USER_ROLES.user,
      isDriver: role === USER_ROLES.driver,
      isAdmin: role === USER_ROLES.admin,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};