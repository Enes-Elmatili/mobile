// app/connect/success.tsx — Deep link handler pour retour Stripe Connect réussi
// Stripe redirige vers fixed://connect/success via la page HTML du backend
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function StripeConnectSuccess() {
  const theme = useAppTheme();

  useEffect(() => {
    async function checkStatus() {
      try {
        const res: any = await api.connect.status();
        if (res?.isStripeReady) {
          router.replace('/(tabs)/dashboard');
        } else {
          // Compte pas encore complet — renvoyer vers l'écran Stripe
          router.replace({ pathname: '/onboarding/stripe', params: { stripeReturn: 'incomplete' } });
        }
      } catch {
        router.replace('/onboarding/stripe');
      }
    }
    checkStatus();
  }, []);

  return (
    <View style={[s.root, { backgroundColor: theme.heroBg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <ActivityIndicator size="large" color={theme.heroText} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
