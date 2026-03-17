import { devLog, devWarn, devError } from './../logger';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, tokenStorage } from '../api';
import { useOnboardingStore } from '../../stores/onboardingStore';

type Role = 'ADMIN' | 'PROVIDER' | 'CLIENT';

type UserData = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  city?: string;
  authProvider?: string; // "email" | "apple" | "google"
  roles: Role[];
  providerStatus?: string; // PENDING | ACTIVE | REJECTED | SUSPENDED
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

  // Subscribe to token changes from storage
  useEffect(() => {
    const unsubscribe = tokenStorage.subscribe((newToken) => {
      devLog('🔄 Token storage updated:', newToken ? 'exists' : 'null');
      setToken(newToken);
    });
    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    devLog('🚪 SIGNOUT');
    setUser(null);
    useOnboardingStore.getState().reset();
    await tokenStorage.removeToken(); // Vide le token AVANT l'appel API
    await api.auth.logout().catch(() => {}); // Ignore si session déjà expirée
  }, []);

  // Ref pour éviter la dépendance cyclique refreshMe → signOut → refreshMe
  const signOutRef = useRef(signOut);
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  const refreshMe = useCallback(async () => {
    // Guard : ne rien faire si pas de token
    const currentToken = await tokenStorage.getToken();
    if (!currentToken) {
      devLog('⏭️ refreshMe: no token, skipping');
      return;
    }

    try {
      devLog('📡 REFRESH ME CALL');
      const res = await api.user.me();
      devLog('📥 ME RESPONSE:', JSON.stringify(res, null, 2));

      const userData = res?.user;
      devLog('🔍 Extracted userData:', userData);

      if (userData && userData.email && userData.id && Array.isArray(userData.roles)) {
        setUser(userData);
        devLog('✅ USER LOADED:', userData.email, 'Roles:', userData.roles);
      } else {
        devWarn('⚠️ ME response sans user valide. userData:', userData);
        await signOutRef.current();
      }
    } catch (e: any) {
      devError('❌ REFRESH ME ERROR:', e.message || e);

      if (e.status === 401) {
        devLog('🔒 Token expired and refresh failed. Signing out.');
        await signOutRef.current();
        // Pas d'Alert ici : l'ApiClient gère déjà l'Alert "Session expirée" sur 401
      } else if (e.status >= 500) {
        devWarn('⚠️ Server error during refresh. Keeping local session.');
      }
    }
  }, []); // Pas de dépendance sur signOut grâce au ref

  // Ref pour éviter que refreshMe dans les deps du useEffect cause des boucles
  const refreshMeRef = useRef(refreshMe);
  useEffect(() => {
    refreshMeRef.current = refreshMe;
  }, [refreshMe]);

  // Boot : lecture du token depuis le secure storage
  // On attend /auth/me AVANT de retirer le spinner pour éviter un flash sur l'écran welcome
  useEffect(() => {
    let cancelled = false;

    const bootUp = async () => {
      try {
        devLog('🔄 BOOT: Reading token from secure storage...');
        const storedToken = await tokenStorage.getToken();

        if (cancelled) {
          devLog('⚠️ Boot cancelled');
          return;
        }

        devLog('🔑 BOOT TOKEN:', storedToken ? `${storedToken.slice(0, 20)}...` : 'null');
        setToken(storedToken);

        if (storedToken) {
          // Attendre /auth/me avant de masquer le spinner —
          // évite le flash welcome → dashboard pour les utilisateurs déjà connectés
          devLog('🔄 BOOT: Awaiting /auth/me before unmounting spinner...');
          await refreshMeRef.current();
          if (cancelled) return;
        }

        setIsBooting(false);
        devLog('✅ BOOT COMPLETE');
      } catch (error) {
        devError('❌ BOOT ERROR:', error);
        if (!cancelled) setIsBooting(false);
      }
    };

    bootUp();
    return () => {
      cancelled = true;
    };
  }, []);

  // Token change → refresh /me (signIn / signOut uniquement — le boot est géré ci-dessus)
  const bootDoneRef = useRef(false);
  useEffect(() => {
    if (isBooting) {
      devLog('⏳ Waiting for boot...');
      return;
    }

    // Premier déclenchement après le boot : bootUp a déjà appelé refreshMe, on saute
    if (!bootDoneRef.current) {
      bootDoneRef.current = true;
      return;
    }

    if (token) {
      refreshMeRef.current();
    } else {
      devLog('❌ No token, clearing user');
      setUser(null);
    }
  }, [token, isBooting]); // refreshMe retiré des deps, géré via ref

  const signIn = useCallback(async (newToken: string) => {
    devLog('🔐 SIGNIN:', newToken.slice(0, 20) + '...');
    await tokenStorage.setToken(newToken);
    devLog('✅ SIGNIN: Token saved to storage');
  }, []);

  const value = useMemo(
    () => ({ isBooting, token, user, signIn, signOut, refreshMe }),
    [isBooting, token, user, signIn, signOut, refreshMe]
  );

  devLog('🔍 AUTH STATE:', {
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