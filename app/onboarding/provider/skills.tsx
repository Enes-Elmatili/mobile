import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout';
import { PROVIDER_FLOW } from '../../../constants/onboardingFlows';
import { useOnboardingStore } from '../../../stores/onboardingStore';

const SKILLS = [
  { id: 'Bricolage', ionicon: 'hammer-outline' as const },
  { id: 'Ménage', ionicon: 'sparkles-outline' as const },
  { id: 'Urgences techniques', ionicon: 'flash-outline' as const },
];

export default function ProviderSkills() {
  const { selectedSkills, setSkills } = useOnboardingStore();
  const [selected, setSelected] = useState<string[]>(selectedSkills);

  function toggleSkill(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function handleContinue() {
    setSkills(selected);
    router.push('/onboarding/provider/documents');
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.SKILLS}
      totalSteps={PROVIDER_FLOW.totalSteps}
      title="Vos métiers."
      subtitle="Sélectionnez vos domaines d'expertise."
      cta={{
        label: 'Continuer',
        onPress: handleContinue,
        disabled: selected.length === 0,
      }}
    >
      <View style={s.list}>
        {SKILLS.map((skill) => {
          const isSelected = selected.includes(skill.id);
          return (
            <TouchableOpacity
              key={skill.id}
              style={[s.chip, isSelected && s.chipSelected]}
              onPress={() => toggleSkill(skill.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Ionicons name={skill.ionicon} size={22} color={isSelected ? '#0a0a0a' : '#fff'} />
              <Text style={[s.chipText, isSelected && s.chipTextSelected]}>
                {skill.id}
              </Text>
              {isSelected && (
                <View style={s.checkCircle}>
                  <Text style={s.checkMark}>{'\u2713'}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selected.length > 0 && (
        <Text style={s.count}>
          {selected.length} métier{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
        </Text>
      )}
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  list: { gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 18,
  },
  chipSelected: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'transparent' },
  chipText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff' },
  chipTextSelected: { color: '#0a0a0a' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  count: {
    fontSize: 13, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', marginTop: 16,
  },
});
