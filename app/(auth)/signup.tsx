// app/(auth)/signup.tsx — FIXED Signup unifié (multi-step provider)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Animated, KeyboardAvoidingView, Platform,
  ScrollView, Easing, StatusBar, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { FixedInput } from '@/lib/components/FixedInput';
import type { InputState } from '@/lib/components/FixedInput';
import { CLIENT_FLOW, PROVIDER_FLOW } from '@/constants/onboardingFlows';

const ROLE_INTENT_KEY = '@fixed:signup:role';

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastType = 'error' | 'success' | 'info';
interface ToastMsg { id: number; type: ToastType; message: string }

function Toast({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  const ty = useRef(new Animated.Value(-72)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, { toValue: 0,   duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.timing(op, { toValue: 1,   duration: 280, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(ty, { toValue: -72, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(onDone);
    }, 3200);
    return () => clearTimeout(t);
  }, []);
  const color = msg.type === 'error' ? '#FF453A' : msg.type === 'success' ? '#34C759' : '#FFF';
  const icon  = msg.type === 'error' ? 'close-circle' : msg.type === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <Animated.View style={[toast.pill, { opacity: op, transform: [{ translateY: ty }] }]}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={toast.text}>{msg.message}</Text>
    </Animated.View>
  );
}

const toast = StyleSheet.create({
  layer: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, left: 20, right: 20, zIndex: 9999, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 10 },
    }),
  },
  text: { fontSize: 14, color: '#FFF', fontWeight: '600', flex: 1 },
});

// ─── Password strength ────────────────────────────────────────────────────────
function StrengthBar({ password }: { password: string }) {
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const colors = ['#FF453A', '#FF9F0A', '#FFD60A', '#22C55E'];
  const labels = ['Faible', 'Moyen', 'Bon', 'Fort'];
  return (
    <View style={str.wrap}>
      <View style={str.barRow}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[str.segment, { backgroundColor: i < score ? colors[score - 1] : 'rgba(255,255,255,0.06)' }]} />
        ))}
      </View>
      <Text style={[str.label, { color: score > 0 ? colors[score - 1] : 'rgba(255,255,255,0.2)' }]}>
        {score > 0 ? labels[score - 1] : ''}
      </Text>
    </View>
  );
}
const str = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -8, marginBottom: 16 },
  barRow: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  label: { fontSize: 11, fontWeight: '600', width: 40 },
});

// ─── Constants ────────────────────────────────────────────────────────────────
const RADIUS_OPTIONS = [
  { value: 5,   label: '5 km',   hint: 'Quartier' },
  { value: 10,  label: '10 km',  hint: 'Ville' },
  { value: 20,  label: '20 km',  hint: 'Agglo.' },
  { value: 30,  label: '30 km',  hint: 'Grand bassin' },
  { value: 50,  label: '50 km',  hint: 'Région' },
  { value: 100, label: '100 km', hint: 'Élargie' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Category { id: number; name: string; icon?: string }

// ══════════════════════════════════════════════════════════════════════════════
//  SIGNUP — Wizard unifié
// ══════════════════════════════════════════════════════════════════════════════
type Phase = 'identity' | 'zone' | 'creating';

export default function Signup() {
  const router = useRouter();
  const { refreshMe } = useAuth();

  // ── Role ────────────────────────────────────────────────────────────────────
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { AsyncStorage.getItem(ROLE_INTENT_KEY).then(r => setRole(r)); }, []);
  const isProvider = role === 'PROVIDER';

  // ── Phase ───────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('identity');

  // ── Step 1: Identity ────────────────────────────────────────────────────────
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [focused,  setFocused]  = useState<string | null>(null);

  // ── Step 2: Zone + Categories ───────────────────────────────────────────────
  const [city,         setCity]         = useState('');
  const [radius,       setRadius]       = useState(10);
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [catsLoading,  setCatsLoading]  = useState(false);

  // ── Shared ──────────────────────────────────────────────────────────────────
  const [msgs,    setMsgs]    = useState<ToastMsg[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++counter.current;
    setMsgs(p => [...p, { id, type, message }]);
  }, []);

  // ── Animation ───────────────────────────────────────────────────────────────
  const fade  = useRef(new Animated.Value(0)).current;
  const transY = useRef(new Animated.Value(20)).current;
  const animateIn = useCallback(() => {
    fade.setValue(0); transY.setValue(20);
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(transY,{ toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, transY]);
  useEffect(() => { animateIn(); }, []);

  // ── Load categories on zone phase ──────────────────────────────────────────
  const [catsError, setCatsError] = useState(false);
  const loadCategories = useCallback(() => {
    setCatsLoading(true);
    setCatsError(false);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000)
    );
    Promise.race([api.taxonomies.list(), timeout])
      .then((res: any) => setCategories(res?.data ?? res ?? []))
      .catch(() => { setCatsError(true); showToast('Erreur de chargement des catégories'); })
      .finally(() => setCatsLoading(false));
  }, []);

  useEffect(() => {
    if (phase === 'zone' && isProvider && categories.length === 0) {
      loadCategories();
    }
  }, [phase, isProvider]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const isEmailValid = EMAIL_RE.test(email.trim());
  const canIdentity = name.trim().length > 0 && isEmailValid && password.length >= 8;
  const canZone = city.trim().length >= 2 && selectedCats.length > 0;

  const nameState: InputState  = focused === 'name' ? 'active' : 'idle';
  const emailState: InputState = focused === 'email' ? 'active' : email.length > 3 && isEmailValid ? 'valid' : email.length > 3 ? 'error' : 'idle';
  const pwdState: InputState   = focused === 'password' ? 'active' : password.length >= 8 ? 'valid' : 'idle';
  const cityState: InputState  = focused === 'city' ? 'active' : city.trim().length >= 2 ? 'valid' : 'idle';

  // ── Navigation entre phases ─────────────────────────────────────────────────
  const goToZone = () => {
    if (!canIdentity) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!name.trim()) showToast('Entrez votre nom');
      else if (!isEmailValid) showToast('Adresse mail invalide');
      else showToast('Mot de passe trop court — 6 caractères min.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase('zone');
    animateIn();
  };

  const goBack = () => {
    Haptics.selectionAsync();
    if (phase === 'zone') { setPhase('identity'); animateIn(); }
    else router.canGoBack() ? router.back() : router.replace('/(auth)/welcome');
  };

  // ── Account creation + provider registration ───────────────────────────────
  const createAccount = async () => {
    if (isProvider && !canZone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (city.trim().length < 2) showToast('Entrez votre ville de base');
      else showToast('Sélectionnez au moins un domaine');
      return;
    }
    if (!isProvider && !canIdentity) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('creating');

    try {
      // 1. Create account
      await api.auth.signup(email.trim().toLowerCase(), password, name.trim() || undefined);

      if (isProvider) {
        // 2. Register as provider
        const selectedCatObjects = categories.filter(c => selectedCats.includes(c.id));
        await api.providers.register({
          name: name.trim(),
          city: city.trim(),
          categoryIds: selectedCats,
        });

        // 3. Refresh JWT (now has PROVIDER role)
        await refreshMe();

        // 4. Store onboarding data for any downstream screens (stripe etc.)
        await AsyncStorage.setItem('onboarding_data', JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          radius,
          categoryIds: selectedCats,
          categories: selectedCatObjects.map(c => ({ id: c.id, name: c.name })),
        }));

        // 5. Documents KYC + Quiz → gérés par les écrans séparés dans /onboarding/
        // (verify-email → /onboarding/documents → /onboarding/quiz → /onboarding/stripe)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        finishSignup();
      } else {
        // Client → straight to verify-email
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        finishSignup();
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(err.message || "Échec de l'inscription");
      setPhase(isProvider ? 'zone' : 'identity');
    }
  };

  const finishSignup = () => {
    // Nettoyer immédiatement les données temporaires
    AsyncStorage.removeItem(ROLE_INTENT_KEY).catch(() => {});
    AsyncStorage.removeItem('onboarding_data').catch(() => {});
    router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim().toLowerCase() } });
  };

  // ── Progress (utilise les constantes unifiées) ──────────────────────────────
  const flow = isProvider ? PROVIDER_FLOW : CLIENT_FLOW;
  const totalSteps = flow.totalSteps;
  const stepNum = isProvider
    ? (phase === 'identity' ? PROVIDER_FLOW.steps.SIGNUP_ID : PROVIDER_FLOW.steps.ZONE)
    : CLIENT_FLOW.steps.REGISTER;

  const toggleCat = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={toast.layer} pointerEvents="none">
        {msgs.map(m => (
          <Toast key={m.id} msg={m} onDone={() => setMsgs(p => p.filter(x => x.id !== m.id))} />
        ))}
      </View>

      {/* Top bar */}
      {phase !== 'creating' && (
        <View style={s.topBar}>
          <Pressable style={s.backBtn} onPress={goBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.45)" />
          </Pressable>
          <Text style={s.logo}>FIXED</Text>
          <View style={s.stepBadge}>
            <Text style={s.stepText}>
              {String(stepNum).padStart(2, '0')} / {totalSteps}
            </Text>
          </View>
        </View>
      )}

      {/* Progress bar */}
      {phase !== 'creating' && (
        <View style={s.progressRow}>
          {Array.from({ length: isProvider ? totalSteps : 2 }).map((_, i) => (
            <View key={i} style={[s.progressSeg, i < stepNum ? s.progressOn : s.progressOff]} />
          ))}
        </View>
      )}

      {/* ═══ CREATING — Loading screen ═══════════════════════════════════════ */}
      {phase === 'creating' && (
        <View style={s.creatingWrap}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={s.creatingText}>Création de votre compte…</Text>
          {isProvider && <Text style={s.creatingSubtext}>Configuration du profil prestataire</Text>}
        </View>
      )}

      {/* ═══ FORM PHASES ═══════════════════════════════════════════════════════ */}
      {phase !== 'creating' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fade, transform: [{ translateY: transY }] }}>

              {/* ─── IDENTITY ──────────────────────────────────────────── */}
              {phase === 'identity' && (
                <>
                  <Text style={s.title}>{'Créez votre\ncompte.'}</Text>
                  <Text style={s.subtitle}>Opérationnel en moins d'une minute.</Text>
                  <View style={s.fields}>
                    <FixedInput label="Nom complet" icon="person-outline" state={nameState}
                      value={name} onChangeText={setName} placeholder="Prénom et nom"
                      autoCapitalize="words" maxLength={60} returnKeyType="next"
                      onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />
                    <FixedInput label="Adresse mail" icon="mail-outline" state={emailState}
                      value={email} onChangeText={setEmail} placeholder="votre@email.com"
                      autoCapitalize="none" keyboardType="email-address" returnKeyType="next"
                      onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />
                    <FixedInput label="Mot de passe" icon="lock-closed-outline" state={pwdState}
                      value={password} onChangeText={setPassword} placeholder="Minimum 6 caractères"
                      secureTextEntry={!showPwd} returnKeyType="done"
                      onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                      onSubmitEditing={isProvider ? goToZone : createAccount}
                      rightElement={
                        <Pressable onPress={() => { Haptics.selectionAsync(); setShowPwd(p => !p); }} hitSlop={8}>
                          <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={17} color="rgba(255,255,255,0.35)" />
                        </Pressable>
                      } />
                    {password.length > 0 && <StrengthBar password={password} />}
                  </View>
                </>
              )}

              {/* ─── ZONE + CATEGORIES ─────────────────────────────────── */}
              {phase === 'zone' && isProvider && (
                <>
                  <Text style={s.title}>{'Votre\nactivité.'}</Text>
                  <Text style={s.subtitle}>Zone d'intervention et domaines d'expertise.</Text>
                  <View style={s.fields}>
                    <FixedInput label="Ville de base" icon="location-outline" state={cityState}
                      value={city} onChangeText={setCity} placeholder="Paris, Lyon, Marseille…"
                      autoCapitalize="words" maxLength={80} returnKeyType="done"
                      onFocus={() => setFocused('city')} onBlur={() => setFocused(null)} />

                    <Text style={s.sectionLabel}>Rayon d'intervention</Text>
                    <View style={s.radiusGrid}>
                      {RADIUS_OPTIONS.map(opt => {
                        const active = radius === opt.value;
                        return (
                          <Pressable key={opt.value} style={[s.radiusCard, active && s.radiusCardActive]}
                            onPress={() => { Haptics.selectionAsync(); setRadius(opt.value); }}>
                            <Text style={[s.radiusLabel, active && s.radiusLabelActive]}>{opt.label}</Text>
                            <Text style={[s.radiusHint, active && s.radiusHintActive]}>{opt.hint}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={[s.sectionLabel, { marginTop: 28 }]}>Vos métiers</Text>
                    {catsLoading ? (
                      <View style={s.centered}><ActivityIndicator size="large" color="rgba(255,255,255,0.4)" /></View>
                    ) : catsError && categories.length === 0 ? (
                      <Pressable style={s.centered} onPress={loadCategories}>
                        <Ionicons name="refresh-outline" size={24} color="rgba(255,255,255,0.4)" />
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 8 }}>Réessayer</Text>
                      </Pressable>
                    ) : (
                      <View style={s.catGrid}>
                        {categories.map(cat => {
                          const sel = selectedCats.includes(cat.id);
                          return (
                            <Pressable key={cat.id} style={[s.chip, sel && s.chipSelected]} onPress={() => toggleCat(cat.id)}>
                              {cat.icon
                                ? <Text style={s.chipIcon}>{cat.icon}</Text>
                                : <Ionicons name="briefcase-outline" size={15} color={sel ? '#111' : 'rgba(255,255,255,0.5)'} />}
                              <Text style={[s.chipText, sel && s.chipTextSelected]}>{cat.name}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                    {selectedCats.length > 0 && (
                      <Text style={s.catCount}>
                        {selectedCats.length} service{selectedCats.length > 1 ? 's' : ''} sélectionné{selectedCats.length > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </>
              )}

            </Animated.View>

            {/* ─── FOOTER (inside scroll) ──────────────────────────────── */}
            <View style={s.footer}>
              {phase === 'identity' && (
                <View style={s.legalRow}>
                  <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.2)" />
                  <Text style={s.legalText}>
                    {'En continuant, vous acceptez nos '}
                    <Text style={s.legalLink}>CGU</Text>
                    {' et '}
                    <Text style={s.legalLink}>Politique de confidentialité</Text>
                  </Text>
                </View>
              )}

              {/* CTA adaptatif */}
              {phase === 'identity' && (
                <Pressable
                  style={[s.cta, !canIdentity && s.ctaDisabled]}
                  onPress={isProvider ? goToZone : createAccount}
                >
                  <Text style={[s.ctaText, !canIdentity && s.ctaTextDisabled]}>
                    {isProvider ? 'Continuer' : "Créer mon compte"}
                  </Text>
                </Pressable>
              )}

              {phase === 'zone' && (
                <Pressable
                  style={[s.cta, !canZone && s.ctaDisabled]}
                  onPress={createAccount}
                  disabled={!canZone}
                >
                  <Text style={[s.ctaText, !canZone && s.ctaTextDisabled]}>Créer mon compte</Text>
                </Pressable>
              )}

              {phase === 'identity' && (
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); router.push('/(auth)/login'); }}
                  style={s.loginLink} hitSlop={8}
                >
                  <Text style={s.loginText}>
                    {'Déjà un compte ?  '}
                    <Text style={s.loginBold}>Se connecter</Text>
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  logo: { fontSize: 16, fontWeight: '900', letterSpacing: 3, color: '#FFF' },
  stepBadge: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  stepText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },

  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 24, marginBottom: 4 },
  progressSeg: { flex: 1, height: 2, borderRadius: 1 },
  progressOn:  { backgroundColor: '#FFF' },
  progressOff: { backgroundColor: 'rgba(255,255,255,0.1)' },

  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },

  title: { fontSize: 30, fontWeight: '800', color: '#FFF', lineHeight: 36, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32 },
  fields: {},

  /* Creating */
  creatingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  creatingText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  creatingSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },

  /* Zone */
  sectionLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, marginBottom: 12 },
  radiusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radiusCard: {
    width: '30%', flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center',
  },
  radiusCardActive:  { backgroundColor: '#FFF', borderColor: '#FFF' },
  radiusLabel:       { fontSize: 15, fontWeight: '700', color: '#FFF' },
  radiusLabelActive: { color: '#111' },
  radiusHint:        { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontWeight: '500' },
  radiusHintActive:  { color: 'rgba(0,0,0,0.45)' },

  centered: { paddingVertical: 40, alignItems: 'center' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipSelected:     { backgroundColor: '#FFF', borderColor: '#FFF' },
  chipIcon:         { fontSize: 15 },
  chipText:         { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  chipTextSelected: { color: '#111' },
  catCount: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 12 },

  /* Footer */
  footer: { paddingTop: 24, gap: 12 },
  legalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  legalText: { flex: 1, color: 'rgba(255,255,255,0.25)', fontSize: 11, lineHeight: 16 },
  legalLink: { color: 'rgba(255,255,255,0.45)', textDecorationLine: 'underline' },

  cta: { height: 54, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#000' },
  ctaTextDisabled: { color: 'rgba(255,255,255,0.2)' },

  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },

  loginLink: { alignItems: 'center', paddingVertical: 4 },
  loginText: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  loginBold: { color: '#FFF', fontWeight: '700' },
});
