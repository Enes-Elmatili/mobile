/* eslint-disable react-hooks/exhaustive-deps */
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '../lib/auth/AuthContext';
import { SocketProvider } from '../lib/SocketContext';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  useColorScheme,
  StatusBar,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = "pk_test_51SAAD8Ai87X1MWTO3ycR3JGdCaSJnpQnnEtrjgpohyfRBQPnYwrLppZc3sjQocisETjUO8uGxlnjCMeq2LKZUeNE004sObC5iL";

// ✅ Routes qui font partie d'un flow mission
// Le layout ne doit JAMAIS rediriger quand l'utilisateur est sur ces routes
const MISSION_FLOW_ROUTES = [
  'ongoing',
  'tracking',
  'earnings',
  'rating',
  'NewRequestStepper',
  'missionview',
];

function RootLayoutNav() {
  const { user, isBooting } = useAuth();
  const segments            = useSegments();
  const router              = useRouter();
  const hasRedirected       = useRef(false);

  // ── Thème système ─────────────────────────────────────────────────────────
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

  useEffect(() => {
    if (isBooting) return;

    const currentPath  = segments.join('/');
    const inAuthGroup  = segments[0] === '(auth)';

    // ✅ GUARD : Ne jamais interrompre un flow mission
    const isOnMissionFlow = MISSION_FLOW_ROUTES.some(route =>
      currentPath.includes(route)
    );

    if (isOnMissionFlow) {
      console.log('🚫 [LAYOUT] Mission flow active, skipping redirect:', currentPath);
      return;
    }

    console.log('🔍 [LAYOUT] Navigation check:', {
      user: user?.email || 'null',
      inAuthGroup,
      path: currentPath,
    });

    if (!user && !inAuthGroup) {
      console.log('➡️ [LAYOUT] Redirect to login');
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        console.log('➡️ [LAYOUT] Redirect to dashboard (post-login)');
        router.replace('/(tabs)/dashboard');
      }
    } else {
      if (inAuthGroup) hasRedirected.current = false;
      console.log('✅ [LAYOUT] No redirect needed');
    }
  }, [user, isBooting, segments]);

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
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.fixed.app"
        urlScheme="fixed"
      >
        <AuthProvider>
          <SocketProvider>
            <RootLayoutNav />
          </SocketProvider>
        </AuthProvider>
      </StripeProvider>
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