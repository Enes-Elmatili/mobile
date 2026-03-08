// app/connect/reauth.tsx — Deep link handler pour Stripe Connect link expiré
// Stripe redirige vers fixed://connect/reauth quand le lien a expiré
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar } from 'react-native';
import { router } from 'expo-router';

export default function StripeConnectReauth() {
  useEffect(() => {
    // Renvoyer vers l'écran Stripe pour régénérer un lien
    router.replace('/onboarding/stripe');
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
