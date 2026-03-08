// app/onboarding/stripe.tsx — Stripe Connect (thème sombre unifié)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { api } from '../../lib/api';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { PROVIDER_FLOW } from '../../constants/onboardingFlows';

const BENEFITS = [
  {
    icon: 'flash-outline' as const,
    title: 'Virements rapides',
    desc: 'Recevez vos paiements sous 2 jours ouvrés sur votre compte bancaire.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Protection Stripe',
    desc: 'Transactions sécurisées, conformité PCI DSS et protection contre la fraude.',
  },
  {
    icon: 'bar-chart-outline' as const,
    title: 'Suivi des paiements',
    desc: 'Tableau de bord dédié pour gérer virements, factures et historique.',
  },
  {
    icon: 'globe-outline' as const,
    title: 'Paiements partout',
    desc: 'Carte bancaire, Apple Pay, Google Pay — tous les modes acceptés.',
  },
];

export default function OnboardingStripe() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleConfigure = async () => {
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('onboarding/provider/stripe-return');
      const res: any = await api.connect.onboarding(redirectUrl);
      const url: string = res?.url;
      if (!url) throw new Error('URL Stripe introuvable. Réessayez.');

      await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'done' });

      // Vérifier le statut Stripe au retour
      const status: any = await api.connect.status();
      if (status?.isStripeReady) {
        router.replace('/(tabs)/dashboard');
        return;
      }
    } catch (e: any) {
      Alert.alert(
        'Erreur Stripe',
        e?.message || 'Réessayez dans quelques instants.',
        [{ text: 'Réessayer', onPress: handleConfigure }, { text: 'Plus tard' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    router.replace('/(tabs)/dashboard');
  };

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.STRIPE}
      totalSteps={PROVIDER_FLOW.totalSteps}
      showBack={false}
      title={'Compte de\npaiement.'}
      subtitle="FIXED utilise Stripe pour virer vos gains directement sur votre compte bancaire, de façon sécurisée et transparente."
      cta={{
        label: loading ? 'Chargement…' : 'Configurer mon compte Stripe',
        onPress: handleConfigure,
        disabled: loading,
        loading,
      }}
      secondaryCta={{ label: 'Passer pour l\'instant', onPress: goToDashboard }}
    >
      {/* Hero icon */}
      <View style={s.heroWrap}>
        <View style={s.heroCircle}>
          <Ionicons name="card-outline" size={44} color="#FFF" />
        </View>
        <View style={s.stripeBadge}>
          <Ionicons name="lock-closed" size={10} color="#635BFF" />
          <Text style={s.stripeBadgeText}>Stripe</Text>
        </View>
      </View>

      {/* Benefits */}
      <View style={s.benefitList}>
        {BENEFITS.map((b, i) => (
          <View key={i} style={s.benefitRow}>
            <View style={s.benefitIcon}>
              <Ionicons name={b.icon} size={18} color="#FFF" />
            </View>
            <View style={s.benefitText}>
              <Text style={s.benefitTitle}>{b.title}</Text>
              <Text style={s.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Trust note */}
      <View style={s.trustNote}>
        <Ionicons name="shield-checkmark-outline" size={14} color="rgba(255,255,255,0.3)" />
        <Text style={s.trustText}>
          Vos données bancaires sont gérées directement par Stripe et ne transitent jamais par FIXED.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  // Hero
  heroWrap: { alignItems: 'center', marginBottom: 28 },
  heroCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  stripeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(99,91,255,0.12)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 12,
  },
  stripeBadgeText: { fontSize: 12, fontWeight: '700', color: '#635BFF' },

  // Benefits
  benefitList: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, padding: 4, marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  benefitIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  benefitText: { flex: 1, gap: 2 },
  benefitTitle: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  benefitDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 17 },

  trustNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 12,
  },
  trustText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 16 },

});
