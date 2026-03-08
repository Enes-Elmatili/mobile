// app/(auth)/verify-email.tsx — FIXED Industrial Auth
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api';
import { MONO, ACCENT } from '@/lib/components/FixedInput';
import { CLIENT_FLOW, PROVIDER_FLOW } from '@/constants/onboardingFlows';

const ROLE_INTENT_KEY = '@fixed:signup:role';

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();

  const [resending, setResending] = useState(false);
  const [resent,    setResent]    = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ROLE_INTENT_KEY).then(r => setRole(r));
  }, []);

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification');
      setResent(true);
    } catch {
      // Ignore — l'utilisateur peut ne pas être authentifié si l'app a été rechargée
    } finally {
      setResending(false);
    }
  };

  const handleContinue = async () => {
    const role = await AsyncStorage.getItem(ROLE_INTENT_KEY);
    await AsyncStorage.removeItem(ROLE_INTENT_KEY);
    if (role === 'PROVIDER') {
      // Flow prestataire : documents KYC → quiz métier → Stripe Connect
      router.replace('/onboarding/documents');
    } else {
      router.replace('/(tabs)/dashboard');
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <SafeAreaView style={s.safe}>

        {/* Barre supérieure */}
        <View style={s.topBar}>
          <View style={{ width: 36 }} />
          <Text style={s.logo}>FIXED</Text>
          <View style={s.stepBadge}>
            <Text style={s.stepText}>
              {role === 'PROVIDER'
                ? `${String(PROVIDER_FLOW.steps.VERIFY_EMAIL).padStart(2, '0')} / ${PROVIDER_FLOW.totalSteps}`
                : `${String(CLIENT_FLOW.steps.VERIFY_EMAIL).padStart(2, '0')} / ${CLIENT_FLOW.totalSteps}`}
            </Text>
          </View>
        </View>

        {/* Contenu */}
        <View style={s.content}>

          {/* Icône */}
          <View style={s.iconWrap}>
            <Ionicons name="mail-outline" size={34} color="#FFF" />
            {/* Indicateur orange */}
            <View style={s.iconDot} />
          </View>

          <Text style={s.title}>{'Vérifiez\nvotre email.'}</Text>

          <Text style={s.subtitle}>
            {'Un lien a été envoyé à\n'}
            <Text style={s.emailText}>{email || 'votre adresse email'}</Text>
          </Text>

          {/* Carte info */}
          <View style={s.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="rgba(255,255,255,0.3)"
              style={{ marginTop: 1, flexShrink: 0 }}
            />
            <Text style={s.infoText}>
              Cliquez sur le lien dans l'email pour activer votre compte. Le lien expire dans 24 heures.
            </Text>
          </View>

          {/* Bouton renvoyer */}
          <TouchableOpacity
            style={[s.resendBtn, (resending || resent) && s.resendBtnDone]}
            onPress={handleResend}
            disabled={resending || resent}
            activeOpacity={0.8}
          >
            {resending
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={[s.resendText, resent && s.resendTextDone]}>
                  {resent ? '✓  Email renvoyé' : 'Renvoyer le lien'}
                </Text>
            }
          </TouchableOpacity>

        </View>

        {/* Footer fixe */}
        <View style={s.footer}>
          <TouchableOpacity style={s.cta} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={s.ctaText}>CONTINUER</Text>
            <Ionicons name="arrow-forward" size={17} color="#000" />
          </TouchableOpacity>
          <Text style={s.hint}>Vous pourrez vérifier votre email plus tard depuis votre profil.</Text>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 8,
  },
  logo: { fontSize: 17, fontWeight: '700', letterSpacing: 4, color: '#FFF' },
  stepBadge: {
    backgroundColor: '#111',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  stepText: { fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },

  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#141414',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28, position: 'relative',
    alignSelf: 'flex-start',
  },
  iconDot: {
    position: 'absolute', bottom: -5, right: -5,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: ACCENT,
    borderWidth: 2.5, borderColor: '#000',
  },

  title: { fontSize: 32, fontWeight: '800', color: '#FFF', lineHeight: 38, marginBottom: 12 },

  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 22, marginBottom: 28 },
  emailText: { color: '#FFF', fontFamily: MONO, fontSize: 14 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#111',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 14,
    marginBottom: 24, width: '100%',
  },
  infoText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 20 },

  resendBtn: {
    height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    width: '100%',
  },
  resendBtnDone: { borderColor: 'rgba(255,255,255,0.08)' },
  resendText:    { fontFamily: MONO, fontSize: 13, color: '#FFF', letterSpacing: 0.5 },
  resendTextDone:{ color: 'rgba(255,255,255,0.35)' },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12, gap: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  cta: {
    height: 54, borderRadius: 14,
    backgroundColor: '#FFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  ctaText: { fontFamily: MONO, fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 1.5 },

  hint: { fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center' },
});
