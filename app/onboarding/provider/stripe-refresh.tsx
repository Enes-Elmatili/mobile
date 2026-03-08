import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function StripeRefresh() {
  useEffect(() => {
    // Lien Stripe expiré — retour à la page de configuration
    router.replace('/onboarding/provider/stripe-connect');
  }, []);

  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
});
