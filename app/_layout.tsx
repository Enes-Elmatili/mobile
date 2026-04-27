import '../lib/i18n'; // i18n — doit être importé avant tout autre module
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../lib/auth/AuthContext';
import { SocketProvider } from '../lib/SocketContext';
import { NetworkProvider } from '../lib/NetworkContext';
import { OfflineQueueProvider } from '../lib/OfflineQueueContext';
import { CallProvider } from '../lib/webrtc/CallContext';
import IncomingCallOverlay from '../components/IncomingCallOverlay';
import { usePushNotifications } from '../lib/usePushNotifications';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  StatusBar,
  Appearance,
} from 'react-native';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useFonts } from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { darkTokens, lightTokens } from '@/hooks/use-app-theme';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://1bf1a0242d483a309a3dafbe00d22e59@o4511135218532352.ingest.de.sentry.io/4511135226396752',

  // Disable PII collection (IP, cookies, user data) for GDPR compliance
  sendDefaultPii: false,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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
  'onboarding',
  'subscription',
  'settings',
  'providers',
  'signup',
  'verify-email',
  'reset-password',
  'forgot-password',
  'messages',
  'notifications',
  'connect',
  'call',
];

function RootLayoutNav() {
  const { user, isBooting, token } = useAuth();
  const segments                   = useSegments();
  const router                     = useRouter();

  usePushNotifications(user?.id);

  // ── Thème système ─────────────────────────────────────────────────────────
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const t           = isDark ? darkTokens : lightTokens;

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
    } else if (userId) {
      // Email non vérifié → forcer la vérification
      if (user?.emailVerified === false) {
        const onVerify = segments.some(s => s === 'verify-email');
        if (!onVerify) {
          router.replace({ pathname: '/(auth)/verify-email', params: { email: user.email } });
        }
        return;
      }

      // Social sign-in users without role → stay in auth for role selection
      if (!user?.roles || user.roles.length === 0) {
        if (segmentKey !== '(auth)/role-select') {
          router.replace('/(auth)/role-select');
        }
        return;
      }

      // Si on est dans le groupe auth mais connecté+vérifié → rediriger
      if (inAuthGroup) {
        const isProvider = user?.roles?.includes('PROVIDER');
        if (isProvider) {
          const ps = user?.providerStatus;
          if (ps === 'ACTIVE') {
            router.replace('/(tabs)/provider-dashboard');
          } else {
            router.replace('/onboarding/provider/pending');
          }
        } else {
          router.replace('/(tabs)/dashboard');
        }
      }
    }
  }, [userId, isBooting, segmentKey, hasToken]);

  if (isBooting) {
    return (
      <View style={[
        styles.loadingContainer,
        { backgroundColor: t.bg },
      ]}>
        <StatusBar
          barStyle={t.statusBar}
          backgroundColor="transparent"
          translucent
        />
        <ActivityIndicator
          size="large"
          color={t.text}
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={t.statusBar}
        backgroundColor="transparent"
        translucent
      />
      <Stack screenOptions={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }} />
    </>
  );
}

// ── Error Boundary global ──────────────────────────────────────────────────
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    if (__DEV__) console.error('AppErrorBoundary caught:', error);
  }
  render() {
    if (this.state.hasError) {
      const dark = Appearance.getColorScheme() === 'dark';
      const t = dark ? darkTokens : lightTokens;
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: t.bg }}>
          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12, color: t.text }}>Une erreur est survenue</Text>
          <Text style={{ fontSize: 14, color: t.textSub, textAlign: 'center', marginBottom: 24 }}>
            L'application a rencontré un problème inattendu.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: t.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: t.accentText, fontWeight: '600' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default Sentry.wrap(function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  if (!fontsLoaded) {
    const dark = Appearance.getColorScheme() === 'dark';
    const t = dark ? darkTokens : lightTokens;
    return (
      <View style={[styles.loadingContainer, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.text} />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <NetworkProvider>
          <StripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier="merchant.app.thefixed"
            urlScheme="fixed"
          >
            <AuthProvider>
              <OfflineQueueProvider>
                <SocketProvider>
                  <CallProvider>
                    <IncomingCallOverlay />
                    <RootLayoutNav />
                  </CallProvider>
                </SocketProvider>
              </OfflineQueueProvider>
            </AuthProvider>
          </StripeProvider>
        </NetworkProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
});