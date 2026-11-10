// app/settings/account.tsx — vos informations, un champ à la fois.
// Une ligne par champ (nom, téléphone, ville, bio et TVA pour le prestataire) ;
// chaque ligne ouvre une feuille à un champ (components/settings/FieldSheet).
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Group, Row, SectionHead } from '@/components/settings/rows';
import { FieldSheet, type FieldSpec } from '@/components/settings/FieldSheet';
import { CascadeItem } from '@/lib/motion/useCascade';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { BookSpread, useSplitPane } from '@/lib/layout';
import { reportError } from '@/lib/logger';

type Key = 'name' | 'phone' | 'city' | 'description' | 'vatNumber';

export default function AccountSettings() {
  const insets = useSafeAreaInsets();
  const isSplit = useSplitPane();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { user, refreshMe } = useAuth();
  const isProvider = !!user?.roles?.includes('PROVIDER');
  const [prov, setProv] = useState<{ description?: string | null; vatNumber?: string | null } | null>(null);
  useEffect(() => {
    if (!isProvider) return;
    api.providers.me().then((res) => { const p = res?.provider ?? res?.data?.provider ?? res?.data ?? res; if (p) setProv({ description: p.description ?? null, vatNumber: p.vatNumber ?? null }); }).catch((e) => reportError(e, 'settings.provider_profile'));
  }, [isProvider]);

  const u = user;
  const values: Record<Key, string> = {
    name: u?.name || '', phone: u?.phone || '', city: u?.city || '',
    description: prov?.description || '', vatNumber: prov?.vatNumber || '',
  };
  const fields: { key: Key; title: string; hint: string; placeholder?: string; keyboardType?: FieldSpec['keyboardType']; multiline?: boolean; autoCapitalize?: FieldSpec['autoCapitalize']; provider?: boolean }[] = [
    { key: 'name', title: t('account.name'), hint: t('account.name_hint'), autoCapitalize: 'words' },
    { key: 'phone', title: t('account.phone'), hint: t('account.phone_hint'), keyboardType: 'phone-pad', placeholder: '+32 4…' },
    { key: 'city', title: t('account.city'), hint: t('account.city_hint'), autoCapitalize: 'words' },
    { key: 'description', title: t('account.bio'), hint: t('account.bio_hint'), multiline: true, provider: true },
    { key: 'vatNumber', title: t('account.vat'), hint: t('account.vat_hint'), autoCapitalize: 'characters', placeholder: 'BE0123456789', provider: true },
  ].filter((f) => !f.provider || isProvider) as any;

  const [field, setField] = useState<FieldSpec | null>(null);
  const open = (i: number) => {
    const f = fields[i];
    setField({ key: f.key, kicker: `${t('profile.information')} · ${i + 1} ${t('account.of')} ${fields.length}`, title: f.title, hint: f.hint, value: values[f.key], placeholder: f.placeholder, keyboardType: f.keyboardType, multiline: f.multiline, autoCapitalize: f.autoCapitalize, maxLength: f.multiline ? 400 : 80 });
  };
  const save = useCallback(async (key: string, value: string) => {
    try {
      if (key === 'description' || key === 'vatNumber') {
        await api.providers.updateMe({ [key]: (key === 'vatNumber' ? value.toUpperCase() : value) || null });
        setProv((p) => ({ ...(p ?? {}), [key]: value || null }));
      } else {
        await api.patch('/me', { [key]: value || null });
      }
      await refreshMe();
      feedback.haptic('success');
    } catch (e: any) { feedback.error(e?.message || t('profile.save_error')); throw e; }
  }, [refreshMe, t]);

  const identityBlock = (
        <CascadeItem index={0}>
        <SectionHead title={t('account.identity')} />
        <Group>
          {fields.map((f, i) => (
            <Row key={f.key} first={i === 0} title={f.title} value={values[f.key] || t('account.empty')} tone={values[f.key] ? 'default' : 'warn'} onPress={() => open(i)} />
          ))}
        </Group>
        </CascadeItem>
  );
  const emailBlock = (
        <CascadeItem index={1}>
        <SectionHead title={t('account.email')} />
        <Group>
          <Row first icon="mail" title={u?.email || ''} sub={t('account.email_sub')} chevron={false} />
        </Group>
        </CascadeItem>
  );
  const header = <SettingsHeader title={t('profile.information')} />;
  const scrollBottom = { paddingBottom: Math.max(insets.bottom, 12) + 24 };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {isSplit ? (
        // Duo déplié : à gauche le compte (l'email, fixe), à droite les champs qu'on modifie.
        <BookSpread
          left={<>{header}<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollBottom}>{emailBlock}</ScrollView></>}
          right={<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.pageTop, scrollBottom]}>{identityBlock}</ScrollView>}
        />
      ) : (
        <>
          {header}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollBottom}>
            {identityBlock}
            {emailBlock}
          </ScrollView>
        </>
      )}
      <FieldSheet field={field} onClose={() => setField(null)} onSave={save} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // Page droite : même marge haute que la page gauche.
  pageTop: { paddingTop: 12 },
});
