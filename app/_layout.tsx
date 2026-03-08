import '../lib/i18n'; // i18n — doit être importé avant tout autre module
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../lib/auth/AuthContext';
import { SocketProvider } from '../lib/SocketContext';
import { NetworkProvider } from '../lib/NetworkContext';
import { OfflineQueueProvider } from '../lib/OfflineQueueContext';
import { OfflineBanner } from '../components/OfflineBanner';
import { usePushNotifications } from '../lib/usePushNotifications';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  useColorScheme,
  StatusBar,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error("EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable is required");
}

// ✅ Routes qui ne doivent pas déclencher de redirection auth
// Inclut les flows mission + les nouvelles routes de l'app
const MISSION_FLOW_ROUTES = [
  'ongoing',
  'tracking',
  'earnings',
  'rating',
  'NewRequestStepper',
  'missionview',
  'explore',
  'subscription',
  'settings',
  'providers',
  'onboarding',
  'signup',
  'verify-email',
  'messages',
  'notifications',
  'connect',
];

function RootLayoutNav() {
  const { user, isBooting, token } = useAuth();
  const segments                   = useSegments();
  const router                     = useRouter();

  usePushNotifications(user?.id);

  // ── Thème système ─────────────────────────────────────────────────────────
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

  // Primitives stables — évitent de relancer l'effet sur chaque re-render
  // `segments` est un nouveau tableau à chaque render (référence instable)
  // `user` est un nouvel objet à chaque setUser() (même données)
  const userId     = user?.id ?? null;
  const hasToken   = !!token;
  const segmentKey = segments.join('/');

  useEffect(() => {
    if (isBooting) return;

    // Token présent mais /auth/me pas encore résolu (rare race condition) — attendre
    if (hasToken && !userId) return;

    // Skip while still on the index route — index.tsx handles the initial
    // redirect auth-aware, avoiding a cross-navigator replace (Slot root
    // can't handle REPLACE → GO_BACK cascade)
    if (!segments[0] || segmentKey === '') return;

    const inAuthGroup = segments[0] === '(auth)';

    // Guard : ne jamais interrompre un flow en cours
    const isOnMissionFlow = MISSION_FLOW_ROUTES.some(route =>
      segments.some(seg => seg === route)
    );
    if (isOnMissionFlow) return;

    if (!userId && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (userId && inAuthGroup) {
      // Routing basé sur le rôle et statut provider
      const isProvider = user?.roles?.includes('PROVIDER');
      if (isProvider) {
        const ps = user?.providerStatus;
        if (ps === 'ACTIVE') {
          router.replace('/(tabs)/provider-dashboard');
        } else {
          // PENDING, REJECTED, etc. → écran d'attente
          router.replace('/onboarding/provider/pending');
        }
      } else {
        router.replace('/(tabs)/dashboard');
      }
    }
  }, [userId, isBooting, segmentKey, hasToken]);

  if (isBooting) {
    return (
      <View style={[
        styles.loadingContainer,
        { backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' },
      ]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <ActivityIndicator
          size="large"
          color={isDark ? '#F2F2F2' : '#172247'}
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <NetworkProvider>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier="merchant.com.fixed.app"
          urlScheme="fixed"
        >
          <AuthProvider>
            <OfflineQueueProvider>
              <SocketProvider>
                <OfflineBanner />
                <RootLayoutNav />
              </SocketProvider>
            </OfflineQueueProvider>
          </AuthProvider>
        </StripeProvider>
      </NetworkProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
});