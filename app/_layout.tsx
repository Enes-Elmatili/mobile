import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../lib/auth/AuthContext';
import { SocketProvider } from '../lib/SocketContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';

// ✅ Récupération sécurisée de la clé publique
// Le fallback (|| "pk_test...") assure que ça marche même si le .env a un souci en dev
const STRIPE_PUBLISHABLE_KEY = "pk_test_51SAAD8Ai87X1MWTO3ycR3JGdCaSJnpQnnEtrjgpohyfRBQPnYwrLppZc3sjQocisETjUO8uGxlnjCMeq2LKZUeNE004sObC5iL";

function RootLayoutNav() {
  const { user, isBooting } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isBooting) {
      console.log('🔄 BOOT IN PROGRESS...');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    console.log('🔍 NAVIGATION CHECK:', {
      user: user?.email || 'null',
      inAuthGroup,
      segments: segments.join('/'),
    });

    if (!user && !inAuthGroup) {
      console.log('➡️ REDIRECT TO LOGIN (no user)');
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      console.log('➡️ REDIRECT TO DASHBOARD (user logged)');
      router.replace('/(tabs)/dashboard');
    } else {
      console.log('✅ No redirect needed');
    }
  }, [user, isBooting, segments, router]);

  if (isBooting) {
    console.log('⏳ Showing boot spinner...');
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
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.fixed.app" // DOIT MATCHER app.json
        urlScheme="fixed"                           // DOIT MATCHER app.json
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
  container: {
    flex: 1,
  },
});
