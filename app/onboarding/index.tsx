// app/onboarding/index.tsx — Étape 1 : Identité
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FixedInput, MONO } from '../../lib/components/FixedInput';
import type { InputState } from '../../lib/components/FixedInput';

const TOTAL = 3;

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

export default function OnboardingStep1() {
  const router = useRouter();
  const { user } = useAuth();

  const [name,    setName]    = useState((user as any)?.name || '');
  const [focused, setFocused] = useState(false);

  const canContinue = name.trim().length >= 2;
  const nameState: InputState = focused ? 'active' : canContinue ? 'valid' : 'idle';

  const handleNext = async () => {
    if (!canContinue) return;
    await AsyncStorage.setItem('onboarding_data', JSON.stringify({
      name: name.trim(),
      description: '',
    }));
    router.push('/onboarding/zone');
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
              <Text style={s.stepText}>01 / {TOTAL}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <StepBar current={1} />
            <Text style={s.title}>Votre identité.</Text>
            <Text style={s.subtitle}>
              Votre nom tel qu'il apparaîtra sur votre profil public.
            </Text>

            <FixedInput
              label="NOM COMPLET"
              icon="person-outline"
              state={nameState}
              value={name}
              onChangeText={setName}
              placeholder="Prénom et nom"
              autoCapitalize="words"
              maxLength={60}
              returnKeyType="done"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={handleNext}
            />
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
  nextBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  nextBtnText:     { fontFamily: MONO, fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 1.5 },
  nextBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
});
