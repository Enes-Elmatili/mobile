import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout';
import { FixedInput } from '../../../lib/components/FixedInput';
import { PROVIDER_FLOW } from '../../../constants/onboardingFlows';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import type { InputState } from '../../../lib/components/FixedInput';

const RADIUS_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
];

export default function ProviderZone() {
  const { city: storedCity, radiusKm: storedRadius, setZone } = useOnboardingStore();
  const [city, setCity] = useState(storedCity || '');
  const [radius, setRadius] = useState(storedRadius || 10);
  const [focused, setFocused] = useState<string | null>(null);

  const canContinue = city.trim().length >= 2;
  const cityState: InputState = focused === 'city' ? 'active' : city.trim().length >= 2 ? 'valid' : 'idle';

  function handleSubmit() {
    if (!canContinue) return;
    setZone(city.trim(), radius);
    router.push('/onboarding/provider/verify-email');
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.ZONE}
      totalSteps={PROVIDER_FLOW.totalSteps}
      title="Où travaillez-vous ?"
      subtitle="Votre zone d'intervention."
      cta={{
        label: 'Continuer',
        onPress: handleSubmit,
        disabled: !canContinue,
      }}
    >
      <View style={s.fields}>
        <FixedInput
          label="Ville" icon="location-outline" state={cityState}
          value={city} onChangeText={setCity} placeholder="Bruxelles, Liège, Anvers…"
          autoCapitalize="words" maxLength={80} returnKeyType="done"
          onFocus={() => setFocused('city')} onBlur={() => setFocused(null)}
        />

        <Text style={s.sectionLabel}>Rayon d'intervention</Text>
        <View style={s.radiusRow}>
          {RADIUS_OPTIONS.map((opt) => {
            const active = radius === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[s.radiusChip, active && s.radiusChipActive]}
                onPress={() => setRadius(opt.value)}
              >
                <Text style={[s.radiusText, active && s.radiusTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  fields: { gap: 4 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5, marginTop: 24, marginBottom: 12,
  },
  radiusRow: { flexDirection: 'row', gap: 10 },
  radiusChip: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  radiusChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  radiusText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  radiusTextActive: { color: '#0a0a0a' },
});
