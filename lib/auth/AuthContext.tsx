import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, tokenStorage } from '../api';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  // 🆕 Subscribe to token changes from storage
  useEffect(() => {
    const unsubscribe = tokenStorage.subscribe((newToken) => {
      console.log('🔄 Token storage updated:', newToken ? 'exists' : 'null');
      setToken(newToken);
    });
    
    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    console.log('🚪 SIGNOUT');
    await api.auth.logout();
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      console.log('📡 REFRESH ME CALL');
      const res = await api.user.me();

      console.log('📥 ME RESPONSE:', JSON.stringify(res, null, 2));

      const userData = res?.user;
      console.log('🔍 Extracted userData:', userData);

      if (userData && userData.email && userData.id) {
        setUser(userData);
        console.log('✅ USER LOADED:', userData.email, 'Roles:', userData.roles);
      } else {
        console.warn('⚠️ ME response sans user valide. userData:', userData);
        await signOut();
      }
    } catch (e: any) {
      console.error('❌ REFRESH ME ERROR:', e.message || e);
      
      if (e.status === 401) {
        console.log('🔒 Token expired and refresh failed. Signing out.');
        await signOut();
      } else if (e.status >= 500) {
        console.warn('⚠️ Server error during refresh. Keeping local session.');
      }
    }
  }, [signOut]);

  // Boot: read token from secure storage
  useEffect(() => {
    let cancelled = false;

    const bootUp = async () => {
      try {
        console.log('🔄 BOOT: Reading token from secure storage...');
        const storedToken = await tokenStorage.getToken();

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

    if (token) {
      refreshMe();
    } else {
      console.log('❌ No token, clearing user');
      setUser(null);
    }
  }, [isBooting, token, refreshMe]);

  const signIn = useCallback(async (newToken: string) => {
    console.log('🔐 SIGNIN:', newToken.slice(0, 20) + '...');
    await tokenStorage.setToken(newToken);
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