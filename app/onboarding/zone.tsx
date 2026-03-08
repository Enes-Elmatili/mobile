// app/onboarding/zone.tsx — Étape 2 : Zone d'intervention
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FixedInput, MONO } from '../../lib/components/FixedInput';
import type { InputState } from '../../lib/components/FixedInput';

const TOTAL = 3;

const RADIUS_OPTIONS = [
  { value: '5',   label: '5 km',   hint: 'Quartier' },
  { value: '10',  label: '10 km',  hint: 'Ville' },
  { value: '20',  label: '20 km',  hint: 'Agglo.' },
  { value: '30',  label: '30 km',  hint: 'Grand bassin' },
  { value: '50',  label: '50 km',  hint: 'Région' },
  { value: '100', label: '100 km', hint: 'Élargie' },
];

function StepBar({ current }: { current: number }) {
  return (
    <View style={bar.row}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <View key={i} style={[bar.seg, i < current ? bar.on : bar.off]} />
      ))}
    </View>
  );
}
const bar = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, marginBottom: 36 },
  seg: { flex: 1, height: 2, borderRadius: 1 },
  on:  { backgroundColor: '#FFF' },
  off: { backgroundColor: 'rgba(255,255,255,0.12)' },
});

export default function OnboardingZone() {
  const router = useRouter();

  const [city,    setCity]    = useState('');
  const [radius,  setRadius]  = useState('10');
  const [focused, setFocused] = useState(false);

  const canContinue = city.trim().length >= 2;
  const cityState: InputState = focused ? 'active' : canContinue ? 'valid' : 'idle';

  const handleNext = async () => {
    if (!canContinue) return;
    const existing = JSON.parse(await AsyncStorage.getItem('onboarding_data') || '{}');
    await AsyncStorage.setItem('onboarding_data', JSON.stringify({
      ...existing,
      city:   city.trim(),
      radius: parseInt(radius, 10) || 10,
    }));
    router.push('/onboarding/categories');
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Header */}
          <View style={s.topBar}>
            {router.canGoBack()
              ? <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                  <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              : <View style={{ width: 38 }} />
            }
            <Text style={s.logo}>FIXED</Text>
            <View style={s.stepBadge}>
              <Text style={s.stepText}>02 / {TOTAL}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <StepBar current={2} />
            <Text style={s.title}>Où travaillez-vous ?</Text>
            <Text style={s.subtitle}>Votre ville de base et le rayon d'intervention.</Text>

            <FixedInput
              label="VILLE DE BASE"
              icon="location-outline"
              state={cityState}
              value={city}
              onChangeText={setCity}
              placeholder="Paris, Lyon, Marseille…"
              autoCapitalize="words"
              maxLength={80}
              returnKeyType="done"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />

            {/* Rayon */}
            <Text style={s.sectionLabel}>RAYON D'INTERVENTION</Text>
            <View style={s.radiusGrid}>
              {RADIUS_OPTIONS.map(opt => {
                const active = radius === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.radiusCard, active && s.radiusCardActive]}
                    onPress={() => setRadius(opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.radiusLabel, active && s.radiusLabelActive]}>{opt.label}</Text>
                    <Text style={[s.radiusHint,  active && s.radiusHintActive]}>{opt.hint}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.nextBtn, !canContinue && s.nextBtnDisabled]}
              onPress={handleNext}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              <Text style={[s.nextBtnText, !canContinue && s.nextBtnTextDisabled]}>SUIVANT</Text>
              <Ionicons name="arrow-forward" size={17} color={canContinue ? '#000' : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  logo: { fontSize: 17, fontWeight: '700', letterSpacing: 4, color: '#FFF' },
  stepBadge: {
    backgroundColor: '#111',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  stepText: { fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 },

  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  title:    { fontSize: 30, fontWeight: '800', color: '#FFF', lineHeight: 36, marginBottom: 8 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 32 },

  sectionLabel: {
    fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2, textTransform: 'uppercase',
    marginBottom: 12, marginTop: 8,
  },
  radiusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radiusCard: {
    width: '30%', flexGrow: 1,
    backgroundColor: '#111',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'center',
  },
  radiusCardActive:  { backgroundColor: '#FFF', borderColor: '#FFF' },
  radiusLabel:       { fontSize: 15, fontWeight: '800', color: '#FFF' },
  radiusLabelActive: { color: '#111' },
  radiusHint:        { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontWeight: '500' },
  radiusHintActive:  { color: 'rgba(0,0,0,0.45)' },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  nextBtn: {
    height: 54, borderRadius: 4,
    backgroundColor: '#FFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  nextBtnDisabled:     { backgroundColor: 'rgba(255,255,255,0.08)' },
  nextBtnText:         { fontFamily: MONO, fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 1.5 },
  nextBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
});
