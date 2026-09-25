// app/settings/login.tsx — la connexion : comment vous entrez (email et mot
// de passe, Apple, Google) et, pour un compte email, le changement de mot de
// passe — trois champs, une feuille chacun.
import React, { useCallback, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { Group, Row, SectionHead } from '@/components/settings/rows';
import { FieldSheet, type FieldSpec } from '@/components/settings/FieldSheet';
import { CascadeItem } from '@/lib/motion/useCascade';
import { PressScale } from '@/components/ui/PressScale';

export default function LoginSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const provider = (user as any)?.authProvider as string | undefined;
  const isEmail = !provider || provider === 'email';
  const [pwd, setPwd] = useState<{ current: string; next: string; confirm: string }>({ current: '', next: '', confirm: '' });
  const [field, setField] = useState<FieldSpec | null>(null);

  const steps: { key: keyof typeof pwd; title: string; hint: string }[] = [
    { key: 'current', title: t('account.pwd_current'), hint: t('account.pwd_current_hint') },
    { key: 'next', title: t('account.pwd_new'), hint: t('profile.pwd_min_length') },
    { key: 'confirm', title: t('account.pwd_confirm'), hint: t('account.pwd_confirm_hint') },
  ];
  const openStep = (i: number) => {
    const st = steps[i];
    setField({ key: st.key, kicker: `${t('account.change_password')} · ${i + 1} ${t('account.of')} 3`, title: st.title, hint: st.hint, value: pwd[st.key], secure: true, autoCapitalize: 'none' });
  };
  const save = useCallback(async (key: string, value: string) => {
    const next = { ...pwd, [key]: value };
    setPwd(next);
    if (key !== 'confirm') { setTimeout(() => openStep(key === 'current' ? 1 : 2), 250); return; }
    if (next.next.length < 8) { feedback.error('profile.pwd_min_length'); throw new Error('short'); }
    if (next.next !== next.confirm) { feedback.error('profile.pwd_mismatch'); throw new Error('mismatch'); }
    try {
      await api.auth.changePassword(next.current, next.next);
      feedback.success('profile.pwd_changed');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (e: any) { feedback.error(e?.message || t('profile.pwd_change_error')); throw e; }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openStep lit steps (stables)
  }, [pwd, t]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={s.head}>
        <PressScale onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile'); }} style={[s.back, { backgroundColor: theme.cardBg, borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
          <Feather name="arrow-left" size={18} color={theme.text as string} />
        </PressScale>
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('profile.login').toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 24 }}>
        <CascadeItem index={0}>
        <SectionHead title={t('account.login_method')} />
        <Group>
          <Row first icon={provider === 'apple' ? 'smartphone' : provider === 'google' ? 'globe' : 'mail'} title={provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : t('account.login_email')} sub={(user as any)?.email || ''} chevron={false} />
        </Group>
        </CascadeItem>
        {isEmail ? (
          <CascadeItem index={1}>
            <SectionHead title={t('account.change_password')} />
            <Group>
              <Row first icon="key" title={t('account.change_password')} sub={t('account.change_password_sub')} onPress={() => openStep(0)} />
            </Group>
          </CascadeItem>
        ) : (
          <Text style={[s.note, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('account.social_note', { provider: provider === 'apple' ? 'Apple' : 'Google' })}</Text>
        )}
      </ScrollView>
      <FieldSheet field={field} onClose={() => setField(null)} onSave={save} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.5, includeFontPadding: false },
  note: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginTop: 18 },
});
