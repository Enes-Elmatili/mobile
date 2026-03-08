import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout';
import { FixedInput } from '../../../lib/components/FixedInput';
import { CLIENT_FLOW } from '../../../constants/onboardingFlows';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth/AuthContext';
import type { InputState } from '../../../lib/components/FixedInput';

export default function ClientIdentity() {
  const { refreshMe } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const canContinue = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  const firstNameState: InputState = focused === 'firstName' ? 'active' : firstName.trim().length >= 2 ? 'valid' : 'idle';
  const lastNameState: InputState = focused === 'lastName' ? 'active' : lastName.trim().length >= 2 ? 'valid' : 'idle';

  async function handleSubmit() {
    if (!canContinue) return;
    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await api.user.updateProfile({ name: fullName });
      await refreshMe();
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de mettre à jour votre profil.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      currentStep={CLIENT_FLOW.steps.IDENTITY}
      totalSteps={CLIENT_FLOW.totalSteps}
      title="Votre identité."
      subtitle="Votre nom tel qu'il apparaîtra sur vos demandes."
      cta={{
        label: 'Terminer',
        onPress: handleSubmit,
        disabled: !canContinue,
        loading,
      }}
    >
      <View style={s.fields}>
        <FixedInput
          label="Prénom" icon="person-outline" state={firstNameState}
          value={firstName} onChangeText={setFirstName} placeholder="Votre prénom"
          autoCapitalize="words" maxLength={40} returnKeyType="next"
          onFocus={() => setFocused('firstName')} onBlur={() => setFocused(null)}
        />
        <FixedInput
          label="Nom" icon="person-outline" state={lastNameState}
          value={lastName} onChangeText={setLastName} placeholder="Votre nom"
          autoCapitalize="words" maxLength={40} returnKeyType="done"
          onFocus={() => setFocused('lastName')} onBlur={() => setFocused(null)}
          onSubmitEditing={handleSubmit}
        />
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  fields: { gap: 4 },
});
