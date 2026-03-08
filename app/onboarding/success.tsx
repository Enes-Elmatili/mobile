// app/onboarding/success.tsx — Confirmation profil prestataire créé (thème sombre unifié)
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import { api } from '../../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { PROVIDER_FLOW } from '../../constants/onboardingFlows';

export default function OnboardingSuccess() {
  const router = useRouter();
  const { refreshMe } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const raw = await AsyncStorage.getItem('onboarding_data');
      const data = raw ? JSON.parse(raw) : {};

      await api.providers.register({
        name: data.name || '',
        description: data.description || undefined,
        phone: data.phone || undefined,
        city: data.city || undefined,
        categoryIds: data.categoryIds || [],
      });

      await refreshMe();
      await AsyncStorage.removeItem('onboarding_data');
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de l\'inscription');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    submit();
  }, []);

  const goToKyc = () => {
    router.replace('/onboarding/documents');
  };

  // Loading state
  if (submitting) {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
        totalSteps={PROVIDER_FLOW.totalSteps}
        showBack={false}
        title={'Création en\ncours…'}
        subtitle="Configuration de votre profil prestataire."
      >
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={s.statusText}>Création de votre profil…</Text>
        </View>
      </OnboardingLayout>
    );
  }

  // Error state
  if (error && !submitting) {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
        totalSteps={PROVIDER_FLOW.totalSteps}
        showBack={false}
        title="Une erreur est survenue"
        subtitle={error}
        cta={{ label: 'Réessayer', onPress: submit }}
        secondaryCta={{ label: 'Continuer quand même', onPress: () => router.replace('/(tabs)/dashboard') }}
      >
        <View style={s.centered}>
          <View style={s.iconWrap}>
            <Ionicons name="close-circle-outline" size={52} color="rgba(255,255,255,0.4)" />
          </View>
        </View>
      </OnboardingLayout>
    );
  }

  // Success state
  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
      totalSteps={PROVIDER_FLOW.totalSteps}
      showBack={false}
      title={'Compte\ncréé !'}
      subtitle="Votre profil prestataire est prêt. Finalisez votre vérification pour recevoir des missions."
      cta={{ label: 'Continuer — Documents KYC', onPress: goToKyc }}
    >
      <View style={s.centered}>
        <View style={s.iconWrap}>
          <Ionicons name="checkmark-circle" size={64} color="#FFF" />
        </View>

        <View style={s.infoBox}>
          <Ionicons name="document-text-outline" size={18} color="rgba(255,255,255,0.4)" />
          <Text style={s.infoText}>
            Prochaine étape : téléversez vos documents KYC et passez le quiz métier pour activer votre badge de confiance.
          </Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  statusText: { fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 14,
    width: '100%',
  },
  infoText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 20 },
});
