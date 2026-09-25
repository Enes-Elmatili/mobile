// app/(tabs)/profile.tsx — le profil, c'est vous (planche 7, 20/09/2026).
//
// Une en-tête calme (photo, nom, une ligne d'identité), puis ce qui est à
// vous : pour le prestataire, ses métiers (chips), trois chiffres sobres, son
// activité (abonnement, virements, entreprise & pièces) ; pour le client, ses
// adresses et le FIXED Pass. En bas, le compte (informations, connexion).
// Les réglages de l'app vivent derrière l'engrenage (app/settings).
// Une information se modifie un champ à la fois (components/settings/FieldSheet).
import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CascadeItem } from '@/lib/motion/useCascade';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api';
import { runWhenIdle } from '@/lib/idle';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import Avatar from '@/components/ui/Avatar';
import { cleanName, cleanEmail } from '@/lib/displayName';
import { translateCategoryRaw } from '@/lib/categoryLabel';
import { toFeatherName } from '@/lib/iconMapper';
import { useAvatar } from '@/lib/profile/avatar';
import { useTabBarPadding } from './_layout';
import { Chip, Figure, Group, Row, SectionHead, type FeatherName } from '@/components/settings/rows';
import { CategoriesSheet } from '@/components/settings/CategoriesSheet';
import { LAYOUT } from '@/lib/motion/layout';
import { PressScale } from '@/components/ui/PressScale';

type ProviderInfo = {
  validationStatus?: string | null; vatNumber?: string | null; description?: string | null;
  avgRating?: number | null; totalRatings?: number | null; jobsCompleted?: number | null; acceptanceRate?: number | null;
  categories?: { id: number; name: string; slug?: string | null; icon?: string | null }[];
};

export default function Profile() {
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const tabBarPadding = useTabBarPadding();
  const brandRefresh = useBrandRefresh();
  const isProvider = !!user?.roles?.includes('PROVIDER');
  const { avatarUri, pick } = useAvatar(user, refreshMe);

  const displayName = cleanName((user as any)?.name, { email: user?.email, fallback: isProvider ? t('profile.provider') : t('profile.client') });
  const email = cleanEmail(user?.email);
  const city = (user as any)?.city || null;
  const since = new Date((user as any)?.createdAt || Date.now()).getFullYear();

  // ─── Données ─────────────────────────────────────────────────────────────
  const [prov, setProv] = useState<ProviderInfo | null>(null);
  const [connect, setConnect] = useState<{ needsOnboarding?: boolean; payoutsEnabled?: boolean } | null>(null);
  const [docsCount, setDocsCount] = useState<number | null>(null);
  // Palier courant tel que le serveur le décrit (/tiers : libellé, commission) — rien d'écrit ici.
  const [plan, setPlan] = useState<{ label: string; rate: number; paid: boolean } | null>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const jobs: Promise<any>[] = [api.addresses.list().catch(() => null)];
    if (isProvider) jobs.push(api.providers.me().catch(() => null), api.connect.balance().catch(() => null), api.providerDocs.list().catch(() => null), api.get('/tiers').catch(() => null));
    const [addr, p, c, docs, sub] = await Promise.all(jobs);
    setAddresses(Array.isArray(addr) ? addr : addr?.data || []);
    if (isProvider) {
      const pr = p?.provider ?? p?.data?.provider ?? p?.data ?? p;
      if (pr) setProv(pr);
      if (c) { const cc = c?.data ?? c; setConnect({ needsOnboarding: cc?.needsOnboarding, payoutsEnabled: cc?.payoutsEnabled }); }
      const list = docs?.documents ?? docs?.data ?? docs;
      if (Array.isArray(list)) setDocsCount(list.length);
      const tiersRes = sub?.data ?? sub;
      const cur = tiersRes?.tiers?.find((x: any) => x.tier === tiersRes.currentTier) ?? tiersRes?.tiers?.find((x: any) => !x.monthlyPriceCents);
      if (cur) setPlan({ label: String(cur.label), rate: Math.round(Number(cur.commissionRate) * 100), paid: Number(cur.monthlyPriceCents) > 0 });
    }
    setRefreshing(false);
  }, [user?.id, isProvider]);

  const lastFetchRef = useRef(0);
  useFocusEffect(useCallback(() => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - lastFetchRef.current > 60_000) { lastFetchRef.current = now; const task = runWhenIdle(() => load()); return () => task.cancel(); }
  }, [user?.id, load]));
  const onRefresh = () => { lastFetchRef.current = Date.now(); setRefreshing(true); load(); };

  const [catsOpen, setCatsOpen] = useState(false);

  const verified = isProvider && prov?.validationStatus === 'ACTIVE';
  // La ligne d'identité : « Vérifié · Plombier & serrurier · Ixelles » / « marie@… · Ixelles ».
  const identityRest = isProvider
    ? [prov?.categories?.length ? prov.categories.map((c) => translateCategoryRaw(c)).join(' & ') : null, city].filter(Boolean).join(' · ')
    : [email, city].filter(Boolean).join(' · ');
  const rating = prov?.avgRating && prov.avgRating > 0 ? prov.avgRating.toFixed(1).replace('.', ',') : '—';
  const payoutsReady = !!connect && !connect.needsOnboarding && connect.payoutsEnabled !== false;

  const openCategories = () => setCatsOpen(true);
  const saveCategories = useCallback(async (ids: number[]) => {
    await api.providers.updateMe({ categoryIds: ids });
    await load();
  }, [load]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <BrandRefreshHeader style={brandRefresh.headerStyle} />
      <Animated.ScrollView
        onScroll={brandRefresh.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />}
      >
        {/* -- En-tête : qui, depuis quand, l'engrenage -- */}
        <View style={s.head}>
          <View>
            <Text style={[s.kicker, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{`${isProvider ? t('profile.provider') : t('profile.client')} · ${t('profile.since', { year: since })}`.toUpperCase()}</Text>
            <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('ext.tabs_profile').toUpperCase()}</Text>
          </View>
          <PressScale onPress={() => { feedback.haptic('light'); router.push('/settings'); }} style={[s.gear, { backgroundColor: theme.cardBg, borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel={t('settings.title')} hitSlop={6}>
            <Feather name="sliders" size={17} color={theme.text as string} />
          </PressScale>
        </View>

        {/* -- Identité -- */}
        <Animated.View entering={FadeIn.duration(220)} style={s.identity}>
          <PressScale onPress={pick} accessibilityRole="button" accessibilityLabel={t('profile.edit_photo')} style={[s.avatarRing, { borderColor: verified ? COLORS.greenBrand : theme.border }]}>
            <Avatar name={displayName} size={58} imageUri={avatarUri} />
            <View style={[s.avatarEdit, { backgroundColor: theme.accent, borderColor: theme.bg }]}><Feather name={verified ? 'check' : 'camera'} size={11} color={theme.accentText as string} /></View>
          </PressScale>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{displayName.toUpperCase()}</Text>
            <Text style={[s.identityLine, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {verified ? <Text style={{ color: theme.greenText }}>{t('profile.verified')}</Text> : null}
              {verified && identityRest ? ' · ' : ''}
              {identityRest}
            </Text>
          </View>
        </Animated.View>

        {isProvider ? (
          <Animated.View layout={LAYOUT}>
            <CascadeItem index={1}>
            {/* -- Métiers -- */}
            <SectionHead title={t('profile.trades')} aside={prov?.categories ? t('profile.trades_count', { n: prov.categories.length }) : null} />
            <View style={s.chips}>
              {(prov?.categories ?? []).map((c) => <Chip key={c.id} label={translateCategoryRaw(c)} icon={toFeatherName(c.icon) as FeatherName} onPress={openCategories} />)}
              <Chip label={t('profile.add_trade')} add onPress={openCategories} />
            </View>

            {/* -- Trois chiffres -- */}
            </CascadeItem>
            <CascadeItem index={2}>
            <View style={s.figs}>
              <Figure value={rating} label={prov?.totalRatings ? `${t('profile.stat_rating')} · ${prov.totalRatings}` : t('profile.stat_rating')} />
              <Figure number={prov?.jobsCompleted ?? 0} label={t('profile.stat_missions')} />
              <Figure number={prov?.acceptanceRate ?? null} value="—" suffix=" %" label={t('profile.stat_accepted')} />
            </View>

            </CascadeItem>
            <CascadeItem index={3}>
            {/* -- Votre activité -- */}
            <SectionHead title={t('profile.activity')} />
            <Group>
              <Row first icon="zap" title={t('profile.subscription')} sub={plan ? t('profile.plan_sub', { plan: plan.label, rate: plan.rate }) : null} value={plan?.paid ? plan.label : t('profile.see_plans')} onPress={() => router.push('/formules')} />
              <Row icon="credit-card" title={t('profile.payouts')} sub={payoutsReady ? t('profile.payouts_ready_sub') : t('profile.payouts_todo_sub')} value={payoutsReady ? t('profile.ready') : t('profile.to_set_up')} tone={payoutsReady ? 'ok' : 'warn'} onPress={() => router.push('/(tabs)/wallet')} />
              <Row icon="file-text" title={t('profile.company')} sub={[prov?.vatNumber ? `${t('profile.vat_label')} ${prov.vatNumber}` : null, docsCount != null ? t('profile.docs_count', { n: docsCount }) : null].filter(Boolean).join(' · ') || t('profile.company_sub')} onPress={() => router.push('/settings/company')} />
            </Group>
            </CascadeItem>
          </Animated.View>
        ) : (
          <Animated.View layout={LAYOUT}>
            <CascadeItem index={1}>
            {/* -- Vos adresses -- */}
            <SectionHead title={t('addresses.title')} aside={addresses.length ? String(addresses.length) : null} />
            <Group>
              {addresses.length ? addresses.map((a, i) => (
                <Row key={a.id} first={i === 0} icon={/maison|home|huis/i.test(a.label || '') ? 'home' : 'map-pin'} title={a.label || t('addresses.address')} sub={a.address} onPress={() => router.push('/settings/addresses')} />
              )) : (
                <Row first icon="map-pin" title={t('addresses.empty')} sub={t('addresses.empty_sub')} chevron={false} />
              )}
            </Group>

            </CascadeItem>
            <CascadeItem index={2}>
            {/* -- FIXED Pass -- */}
            <SectionHead title="FIXED Pass" />
            <Group>
              {/* Le Pass n'est pas encore ouvert : pas de lien vers la page d'abonnement prestataire. */}
              <Row first icon="zap" title={t('profile.pass_none')} sub={t('profile.pass_sub')} value={t('formules.soon_title')} chevron={false} />
            </Group>
            </CascadeItem>
          </Animated.View>
        )}

        {/* -- Compte -- */}
        <CascadeItem index={4}>
          <SectionHead title={t('profile.account')} />
          <Group>
            <Row first icon="user" title={t('profile.information')} sub={isProvider ? t('profile.information_sub_provider') : t('profile.information_sub')} onPress={() => router.push('/settings/account')} />
            <Row icon="key" title={t('profile.login')} sub={loginSub(user, t)} onPress={() => router.push('/settings/login')} />
          </Group>
        </CascadeItem>
      </Animated.ScrollView>

      {isProvider && catsOpen ? <CategoriesSheet selectedIds={(prov?.categories ?? []).map((c) => c.id)} onClose={() => setCatsOpen(false)} onSave={saveCategories} /> : null}
    </SafeAreaView>
  );
}

function loginSub(user: any, t: (k: string) => string): string {
  const p = user?.authProvider;
  if (p === 'apple') return 'Apple';
  if (p === 'google') return 'Google';
  return t('profile.login_password');
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  kicker: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  title: { fontFamily: FONTS.bebas, fontSize: 34, letterSpacing: 0.5, includeFontPadding: false },
  gear: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 18 },
  avatarRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarEdit: { position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: FONTS.bebas, fontSize: 24, letterSpacing: 0.5, includeFontPadding: false },
  identityLine: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 10 },
  figs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 10 },
});
