/* eslint-disable react-hooks/exhaustive-deps */
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '../lib/auth/AuthContext';
import { SocketProvider } from '../lib/SocketContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import config from '../lib/config';

// ✅ Routes qui font partie d'un flow mission
// Le layout ne doit JAMAIS rediriger quand l'utilisateur est sur ces routes
const MISSION_FLOW_ROUTES = [
  'ongoing',
  'tracking',
  'earnings',
  'rating',
  'NewRequestStepper',
];

function RootLayoutNav() {
  const { user, isBooting } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isBooting) return;

    const currentPath = segments.join('/');
    const inAuthGroup = segments[0] === '(auth)';

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
      // ✅ Seulement rediriger vers dashboard une fois après login
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        console.log('➡️ [LAYOUT] Redirect to dashboard (post-login)');
        router.replace('/(tabs)/dashboard');
      }
    } else {
      // ✅ Reset le flag quand on est sur auth (= on s'est déconnecté)
      if (inAuthGroup) hasRedirected.current = false;
      console.log('✅ [LAYOUT] No redirect needed');
    }
  }, [user, isBooting, segments]);

  if (isBooting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#172247" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <StripeProvider
        publishableKey={config.stripePublishableKey}
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
});