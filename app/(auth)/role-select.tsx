// app/(auth)/role-select.tsx — Sélection du rôle
import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  SafeAreaView, Platform, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROLE_INTENT_KEY = '@fixed:signup:role';

/* ── Carte avec micro-interaction scale ────────────────────────── */
function RoleCard({
  role, icon, title, tagline, isSelected, onPress,
}: {
  role: 'CLIENT' | 'PROVIDER';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tagline: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[s.card, isSelected && s.cardSelected]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <View style={s.cardRow}>
          <View style={[s.iconWrap, isSelected && s.iconWrapSelected]}>
            <Ionicons
              name={icon}
              size={26}
              color={isSelected ? '#111' : '#FFF'}
            />
          </View>
          <View style={s.cardTextWrap}>
            <Text style={[s.cardTitle, isSelected && s.cardTitleSelected]}>
              {title}
            </Text>
            <Text style={[s.cardTagline, isSelected && s.cardTaglineSelected]}>
              {tagline}
            </Text>
          </View>
          <View style={[s.radio, isSelected && s.radioSelected]}>
            {isSelected && (
              <Ionicons name="checkmark" size={13} color="#FFF" />
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ── Écran principal ───────────────────────────────────────────── */
export default function RoleSelect() {
  const router = useRouter();
  const [selected, setSelected] = useState<'CLIENT' | 'PROVIDER' | null>(null);

  const select = (role: 'CLIENT' | 'PROVIDER') => {
    setSelected(role);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirm = async () => {
    if (!selected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem(ROLE_INTENT_KEY, selected);
    router.push('/(auth)/signup');
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <Pressable
            style={s.backBtn}
            onPress={() => { Haptics.selectionAsync(); router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'); }}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.45)" />
          </Pressable>
          <Text style={s.logo}>FIXED</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Contenu centré */}
        <View style={s.content}>
          <Text style={s.title}>Vous êtes…</Text>
          <Text style={s.subtitle}>
            Choisissez votre profil pour commencer.
          </Text>

          <View style={s.cards}>
            <RoleCard
              role="CLIENT"
              icon="sparkles-outline"
              title="Client"
              tagline="Trouvez un pro en 2 minutes."
              isSelected={selected === 'CLIENT'}
              onPress={() => select('CLIENT')}
            />
            <RoleCard
              role="PROVIDER"
              icon="flash-outline"
              title="Prestataire"
              tagline="Accédez à des missions qualifiées."
              isSelected={selected === 'PROVIDER'}
              onPress={() => select('PROVIDER')}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Pressable
            style={[s.confirmBtn, !selected && s.confirmBtnDisabled]}
            onPress={confirm}
            disabled={!selected}
          >
            <Text style={[s.confirmText, !selected && s.confirmTextDisabled]}>
              Continuer
            </Text>
          </Pressable>

          <Pressable
            style={s.loginLink}
            onPress={() => { Haptics.selectionAsync(); router.push('/(auth)/login'); }}
            hitSlop={8}
          >
            <Text style={s.loginText}>
              Déjà un compte ?{'  '}
              <Text style={s.loginBold}>Se connecter</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, paddingHorizontal: 24 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  logo: {
    fontSize: 16, fontWeight: '900', color: '#FFF',
    letterSpacing: 3,
  },

  /* Centre */
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  title: {
    fontSize: 32, fontWeight: '900', color: '#FFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.4)',
    marginBottom: 32,
  },
  cards: { gap: 12 },

  /* Card */
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardSelected: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapSelected: { backgroundColor: 'rgba(0,0,0,0.07)' },
  cardTextWrap: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: 18, fontWeight: '700', color: '#FFF',
    marginBottom: 2,
  },
  cardTitleSelected: { color: '#111' },
  cardTagline: {
    fontSize: 13, color: 'rgba(255,255,255,0.4)',
    lineHeight: 18,
  },
  cardTaglineSelected: { color: 'rgba(0,0,0,0.45)' },

  /* Radio check */
  radio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12,
  },
  radioSelected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },

  /* Footer */
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    alignItems: 'center',
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  confirmText: {
    fontSize: 16, fontWeight: '700', color: '#000',
  },
  confirmTextDisabled: {
    color: 'rgba(255,255,255,0.2)',
  },
  loginLink: { paddingVertical: 16 },
  loginText: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  loginBold: { color: '#FFF', fontWeight: '700' },
});
