import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout';
import { PROVIDER_FLOW } from '../../../constants/onboardingFlows';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { api } from '../../../lib/api';

export default function ProviderVerifyEmail() {
  const email = useOnboardingStore((s) => s.email);
  const [resending, setResending] = useState(false);

  async function handleResend() {
    setResending(true);
    try {
      await api.post('/auth/resend-verification');
      Alert.alert('Email envoyé', 'Un nouveau lien de vérification a été envoyé.');
    } catch {
      Alert.alert('Erreur', 'Impossible de renvoyer le lien.');
    } finally {
      setResending(false);
    }
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.VERIFY_EMAIL}
      totalSteps={PROVIDER_FLOW.totalSteps}
      title="Vérifiez votre email."
      subtitle={`Un lien a été envoyé à ${email || 'votre adresse'}.`}
      cta={{
        label: 'Continuer',
        onPress: () => router.push('/onboarding/provider/skills'),
      }}
      secondaryCta={{
        label: 'Vérifier plus tard',
        onPress: () => router.push('/onboarding/provider/skills'),
      }}
    >
      <View style={s.content}>
        <View style={s.iconCircle}>
          <Ionicons name="mail-outline" size={40} color="#fff" />
        </View>

        <Text style={s.info}>
          Cliquez sur le lien dans l'email pour vérifier votre adresse.
          Un email vérifié est requis avant de pouvoir recevoir des missions.
        </Text>

        <View style={s.resendRow}>
          <Text style={s.resendLabel}>Pas reçu ?</Text>
          <Text
            style={[s.resendLink, resending && s.resendLinkDisabled]}
            onPress={resending ? undefined : handleResend}
          >
            {resending ? 'Envoi...' : 'Renvoyer le lien'}
          </Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: 24, gap: 20 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  info: {
    fontSize: 14, color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', lineHeight: 22, paddingHorizontal: 8,
  },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resendLabel: { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  resendLink: { fontSize: 13, color: '#fff', fontWeight: '600' },
  resendLinkDisabled: { color: 'rgba(255,255,255,0.3)' },
});
