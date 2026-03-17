// app/connect/reauth.tsx — Deep link handler pour Stripe Connect link expiré
// Stripe redirige vers fixed://connect/reauth quand le lien a expiré
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function StripeConnectReauth() {
  const theme = useAppTheme();

  useEffect(() => {
    // Renvoyer vers l'écran Stripe pour régénérer un lien
    router.replace('/onboarding/stripe');
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
