import { useState } from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout';
import { FixedInput } from '../../../lib/components/FixedInput';
import { PROVIDER_FLOW } from '../../../constants/onboardingFlows';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { api } from '../../../lib/api';
import type { InputState } from '../../../lib/components/FixedInput';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ProviderSignupId() {
  const { setCredentials, setIdentity } = useOnboardingStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+32 ');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const isEmailValid = EMAIL_RE.test(email.trim());
  const canContinue =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    isEmailValid &&
    password.length >= 8 &&
    phone.trim().length >= 4;

  const firstNameState: InputState = focused === 'firstName' ? 'active' : firstName.trim().length >= 2 ? 'valid' : 'idle';
  const lastNameState: InputState = focused === 'lastName' ? 'active' : lastName.trim().length >= 2 ? 'valid' : 'idle';
  const emailState: InputState = focused === 'email' ? 'active' : email.length > 3 && isEmailValid ? 'valid' : email.length > 3 ? 'error' : 'idle';
  const pwdState: InputState = focused === 'password' ? 'active' : password.length >= 8 ? 'valid' : 'idle';
  const phoneState: InputState = focused === 'phone' ? 'active' : phone.trim().length >= 4 ? 'valid' : 'idle';

  async function handleSubmit() {
    if (!canContinue) return;
    setLoading(true);
    try {
      await api.auth.signup(email.trim().toLowerCase(), password, undefined, {
        role: 'PROVIDER',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      setCredentials(email.trim().toLowerCase(), password);
      setIdentity(firstName.trim(), lastName.trim(), phone.trim());
      router.push('/onboarding/provider/zone');
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Échec de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.SIGNUP_ID}
      totalSteps={PROVIDER_FLOW.totalSteps}
      title="Votre identité."
      subtitle="Ces informations apparaîtront sur votre profil public."
      cta={{
        label: 'Continuer',
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
          autoCapitalize="words" maxLength={40} returnKeyType="next"
          onFocus={() => setFocused('lastName')} onBlur={() => setFocused(null)}
        />
        <FixedInput
          label="Téléphone" icon="call-outline" state={phoneState}
          value={phone} onChangeText={setPhone} placeholder="+32 470 00 00 00"
          keyboardType="phone-pad" maxLength={20} returnKeyType="next"
          onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
        />
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
          rightElement={
            <Pressable onPress={() => setShowPwd(p => !p)} hitSlop={8}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={17} color="rgba(255,255,255,0.35)" />
            </Pressable>
          }
        />
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  fields: { gap: 4 },
});
