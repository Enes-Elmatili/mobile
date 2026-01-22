import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '../api';

type Role = 'ADMIN' | 'PROVIDER' | 'CLIENT';

type UserData = {
  id: string;
  email: string;
  name?: string;
  roles: Role[];
};

type AuthState = {
  isBooting: boolean;
  token: string | null;
  user: UserData | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.error('Storage getItem error:', e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Storage setItem error:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Storage removeItem error:', e);
    }
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  const signOut = useCallback(async () => {
    console.log('🚪 SIGNOUT');
    await storage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      console.log('📡 REFRESH ME CALL');
      const res = await api.user.me();

      console.log('📥 ME RESPONSE:', JSON.stringify(res, null, 2));

      // ✅ TON BACKEND RENVOIE { data: { ... } }
      const userData = res?.data || res?.user || res;
      console.log('🔍 Extracted userData:', userData);

      if (userData && userData.email && userData.id) {
        setUser(userData);
        console.log('✅ USER LOADED:', userData.email, 'Roles:', userData.roles);
      } else {
        console.warn('⚠️ ME response sans user valide. userData:', userData);
        // We only sign out if the server explicitly returned success but no data (logic error)
        await signOut();
      }
    } catch (e: any) {
      console.error('❌ REFRESH ME ERROR:', e.message || e);
      
      // FIX: Only sign out on 401 (Unauthorized)
      // If it's a 500 or JSON parse error (HTML response), keep the local token active
      if (e.status === 401 || e.message?.includes('401')) {
         console.log('🔒 Token expired or invalid (401). Signing out.');
         await signOut();
      } else {
         console.warn('⚠️ Server error during refresh. Keeping local session.');
      }
    }
  }, [signOut]);

  // Boot: lire token
  useEffect(() => {
    let cancelled = false;

    const bootUp = async () => {
      try {
        console.log('🔄 BOOT: Reading token from storage...');
        const storedToken = await storage.getItem('auth_token');

        if (cancelled) {
          console.log('⚠️ Boot cancelled');
          return;
        }

        console.log('🔑 BOOT TOKEN:', storedToken ? `${storedToken.slice(0, 20)}...` : 'null');
        setToken(storedToken);
        setIsBooting(false);
        console.log('✅ BOOT COMPLETE');
      } catch (error) {
        console.error('❌ BOOT ERROR:', error);
        setIsBooting(false);
      }
    };

    bootUp();

    return () => {
      cancelled = true;
    };
  }, []);

  // Token change → refresh /me
  useEffect(() => {
    if (isBooting) {
      console.log('⏳ Waiting for boot...');
      return;
    }

    console.log('🔄 Token changed:', token ? 'exists' : 'null');

    if (token) {
      refreshMe();
    } else {
      console.log('❌ No token, clearing user');
      setUser(null);
    }
  }, [isBooting, token, refreshMe]);

  const signIn = useCallback(async (newToken: string) => {
    console.log('🔐 SIGNIN:', newToken.slice(0, 20) + '...');
    await storage.setItem('auth_token', newToken);
    setToken(newToken);
    console.log('✅ SIGNIN: Token saved to storage');
  }, []);

  const value = useMemo(
    () => ({ isBooting, token, user, signIn, signOut, refreshMe }),
    [isBooting, token, user, signIn, signOut, refreshMe]
  );

  console.log('🔍 AUTH STATE:', {
    isBooting,
    hasToken: !!token,
    hasUser: !!user,
    userEmail: user?.email,
    userId: user?.id,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}