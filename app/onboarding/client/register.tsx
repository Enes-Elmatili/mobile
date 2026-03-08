import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout';
import { FixedInput } from '../../../lib/components/FixedInput';
import { CLIENT_FLOW } from '../../../constants/onboardingFlows';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { api } from '../../../lib/api';
import type { InputState } from '../../../lib/components/FixedInput';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ClientRegister() {
  const { setCredentials } = useOnboardingStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const isEmailValid = EMAIL_RE.test(email.trim());
  const canContinue = isEmailValid && password.length >= 8;

  const emailState: InputState = focused === 'email' ? 'active' : email.length > 3 && isEmailValid ? 'valid' : email.length > 3 ? 'error' : 'idle';
  const pwdState: InputState = focused === 'password' ? 'active' : password.length >= 8 ? 'valid' : 'idle';

  async function handleSubmit() {
    if (!canContinue) return;
    setLoading(true);
    try {
      await api.auth.signup(email.trim().toLowerCase(), password, undefined, { role: 'CLIENT' });
      setCredentials(email.trim().toLowerCase(), password);
      router.push('/onboarding/client/verify-email');
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Échec de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      currentStep={CLIENT_FLOW.steps.REGISTER}
      totalSteps={CLIENT_FLOW.totalSteps}
      title="Votre compte."
      subtitle="Créez votre accès FIXED."
      cta={{
        label: 'Continuer',
        onPress: handleSubmit,
        disabled: !canContinue,
        loading,
      }}
    >
      <View style={s.fields}>
        <FixedInput
          label="Adresse mail" icon="mail-outline" state={emailState}
          value={email} onChangeText={setEmail} placeholder="votre@email.com"
          autoCapitalize="none" keyboardType="email-address" returnKeyType="next"
          onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
        />
        <FixedInput
          label="Mot de passe" icon="lock-closed-outline" state={pwdState}
          value={password} onChangeText={setPassword} placeholder="Minimum 8 caractères"
          secureTextEntry={!showPwd} returnKeyType="done"
          onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
          onSubmitEditing={handleSubmit}
        />
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  fields: { gap: 4 },
});
