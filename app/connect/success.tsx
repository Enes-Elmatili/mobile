// app/connect/success.tsx — Deep link handler pour retour Stripe Connect réussi
// Stripe redirige vers fixed://connect/success via la page HTML du backend
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';

export default function StripeConnectSuccess() {
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
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ActivityIndicator size="large" color="#FFF" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
});
