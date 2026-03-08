// app/onboarding/categories.tsx — Étape 3 : Services
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MONO } from '../../lib/components/FixedInput';

const TOTAL = 3;

interface Category { id: number; name: string; icon?: string }

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

export default function OnboardingCategories() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected,   setSelected]   = useState<number[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    api.taxonomies.list().then((res: any) => {
      setCategories(res?.data ?? res ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = async () => {
    if (selected.length === 0) return;
    const existing = JSON.parse(await AsyncStorage.getItem('onboarding_data') || '{}');
    const selectedCats = categories.filter(c => selected.includes(c.id));
    await AsyncStorage.setItem('onboarding_data', JSON.stringify({
      ...existing,
      categoryIds: selected,
      categories: selectedCats.map(c => ({ id: c.id, name: c.name })),
    }));
    router.push('/onboarding/success');
  };

  const canContinue = selected.length > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={s.safe}>

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
            <Text style={s.stepText}>03 / {TOTAL}</Text>
          </View>
        </View>

        <View style={s.content}>
          <StepBar current={3} />
          <Text style={s.title}>Vos métiers.</Text>
          <Text style={s.subtitle}>Sélectionnez vos domaines d'expertise.</Text>

          {loading ? (
            <View style={s.centered}>
              <ActivityIndicator size="large" color="rgba(255,255,255,0.4)" />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={s.grid}>
                {categories.map(cat => {
                  const sel = selected.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[s.chip, sel && s.chipSelected]}
                      onPress={() => toggle(cat.id)}
                      activeOpacity={0.75}
                    >
                      {cat.icon
                        ? <Text style={s.chipIcon}>{cat.icon}</Text>
                        : <Ionicons name="briefcase-outline" size={15} color={sel ? '#111' : 'rgba(255,255,255,0.5)'} />
                      }
                      <Text style={[s.chipText, sel && s.chipTextSelected]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.count}>
            {canContinue
              ? `${selected.length} service${selected.length > 1 ? 's' : ''} sélectionné${selected.length > 1 ? 's' : ''}`
              : 'Sélectionnez au moins un domaine'}
          </Text>
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

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  title:    { fontSize: 30, fontWeight: '800', color: '#FFF', lineHeight: 36, marginBottom: 8 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 32 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 20 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: '#111',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSelected:     { backgroundColor: '#FFF', borderColor: '#FFF' },
  chipIcon:         { fontSize: 15 },
  chipText:         { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  chipTextSelected: { color: '#111' },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  count: { fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
  nextBtn: {
    height: 54, borderRadius: 4,
    backgroundColor: '#FFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  nextBtnDisabled:     { backgroundColor: 'rgba(255,255,255,0.08)' },
  nextBtnText:         { fontFamily: MONO, fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 1.5 },
  nextBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
});
