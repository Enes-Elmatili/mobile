// components/mission/blocks.tsx
// Les blocs d'une fiche mission (planches 2A, 3A, 4A), tous nourris par
// MissionBrief : titre (prestation, catégorie, mode, durée), grille de faits
// (quand, où, accès, client, phrase), ligne de gain, bloc accès, bloc client,
// bloc prestataire (côté client), anneau du compte à rebours.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { cleanName } from '@/lib/displayName';
import { translateSubcategory } from '@/lib/categoryLabel';
import i18nInstance from '@/lib/i18n';
import { formatEUR } from '@/lib/format';
import { accessLabel, etaMinutes, formatRating, isQuoteMode, netFor, type MissionBrief } from '@/lib/mission/brief';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

// ─── Helpers de libellés ─────────────────────────────────────────────────────
export function serviceName(brief: MissionBrief): string {
  return translateSubcategory(i18nInstance.language, { name: brief.service.name, nameI18n: brief.service.nameI18n }) || brief.service.categoryName || '';
}

export function categoryIcon(brief: MissionBrief): FeatherName {
  const slug = (brief.service.categorySlug || brief.service.categoryName || '').toLowerCase();
  if (slug.includes('plomb')) return 'droplet';
  if (slug.includes('serrur')) return 'lock';
  if (slug.includes('electr')) return 'zap';
  if (slug.includes('menage')) return 'home';
  return 'tool';
}

const DAY_KEYS = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'] as const;

/** « Maintenant » / « Lun 15 · 10:00 », avec l'urgence en suffixe. */
export function scheduleLabel(brief: MissionBrief, t: (k: string, o?: any) => string): string {
  const urgent = brief.schedule.urgent ? ` · ${t('mission.urgent')}` : '';
  if (brief.schedule.mode === 'now' || !brief.schedule.at) return `${t('mission.now')}${urgent}`;
  const d = new Date(brief.schedule.at);
  const day = t(`stepper.${DAY_KEYS[d.getDay()]}`);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} ${d.getDate()} · ${time}${urgent}`;
}

/** « 6 min · 2,1 km » ou null. */
export function distanceLabel(brief: MissionBrief, t: (k: string, o?: any) => string): string | null {
  const km = brief.place.distanceKm;
  if (km == null) return null;
  return t('mission.eta', { n: etaMinutes(km), km: km.toFixed(1).replace('.', ',') });
}

/** Quartier / ville : le dernier segment de l'adresse, sans le code postal. */
const COUNTRY = /^(belgique|belgi[eë]|belgium|france|nederland|netherlands|luxembourg)$/i;
/** « Rue de Livourne 13, 1050 Ixelles, Belgique » → « Ixelles » (jamais le pays). */
export function placeShort(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean).filter((p) => !COUNTRY.test(p));
  const withZip = parts.find((p) => /^\d{4}\s+\S/.test(p));
  const last = withZip ?? parts[parts.length - 1] ?? address;
  return last.replace(/^\d{4}\s*/, '') || last;
}

export function modeLabel(brief: MissionBrief, t: (k: string) => string): string {
  return isQuoteMode(brief.money.pricingMode ?? brief.service.pricingMode) ? t('mission.quote') : t('mission.fixed');
}

// ─── Anneau du compte à rebours ──────────────────────────────────────────────
// Sans Reanimated sur le SVG : animer strokeDashoffset via animatedProps plante
// sur Android (react-native-svg #1481 / #2248). L'anneau est piloté par un
// état React rafraîchi 10 fois par seconde — assez fluide pour 60 s, sûr
// sur les deux plateformes. strokeDasharray en tableau, jamais en chaîne.
const RING = 44;
const STROKE = 3;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;
const TICK_MS = 100;

export function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const [startedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), TICK_MS);
    return () => clearInterval(id);
  }, [reduced, startedAt]);
  const progress = reduced ? seconds / total : Math.max(0, 1 - elapsedMs / (total * 1000));
  const color = seconds <= 5 ? COLORS.red : seconds <= 10 ? COLORS.amber : (theme.text as string);
  return (
    <View style={ring.wrap} accessibilityLabel={`${seconds}`}>
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={theme.border as string} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2} cy={RING / 2} r={R} stroke={color} strokeWidth={STROKE} fill="none"
          strokeDasharray={[C, C]} strokeDashoffset={C * (1 - progress)} strokeLinecap="round"
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text style={[ring.num, { color }]}>{seconds}</Text>
    </View>
  );
}
const ring = StyleSheet.create({
  wrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  num:  { position: 'absolute', fontFamily: FONTS.bebas, fontSize: 18, includeFontPadding: false, fontVariant: ['tabular-nums'] },
});

// ─── Titre ───────────────────────────────────────────────────────────────────
export function MissionTitle({ brief, big = false, right }: { brief: MissionBrief; big?: boolean; right?: React.ReactNode }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const sub = [
    brief.service.categoryName,
    modeLabel(brief, t).toLowerCase(),
    brief.service.durationMinutes ? t('mission.minutes', { n: brief.service.durationMinutes }) : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={ti.row}>
      <View style={[ti.icon, { backgroundColor: theme.surface }]}>
        <Feather name={categoryIcon(brief)} size={18} color={theme.text as string} />
      </View>
      <View style={ti.text}>
        <Text style={[ti.name, big && ti.nameBig, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{serviceName(brief)}</Text>
        <Text style={[ti.sub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {sub}{brief.schedule.urgent ? <Text style={{ color: COLORS.amber, fontFamily: FONTS.mono, letterSpacing: 1 }}> · {t('mission.urgent').toUpperCase()}</Text> : null}
        </Text>
      </View>
      {right}
    </View>
  );
}
const ti = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text:    { flex: 1, minWidth: 0 },
  name:    { fontFamily: FONTS.bebas, fontSize: 24, letterSpacing: 0.3, includeFontPadding: false },
  nameBig: { fontSize: 30 },
  sub:     { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 2 },
});

// ─── Faits ───────────────────────────────────────────────────────────────────
function Fact({ icon, main, sub, wide }: { icon: FeatherName; main: string; sub?: string | null; wide?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={[fa.item, wide && fa.wide]}>
      <Feather name={icon} size={14} color={theme.textMuted as string} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[fa.main, { color: theme.text }]} numberOfLines={wide ? 3 : 1} maxFontSizeMultiplier={1.3}>{main}</Text>
        {sub ? <Text style={[fa.sub, { color: theme.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function MissionFacts({ brief }: { brief: MissionBrief }) {
  const { t } = useTranslation();
  const dist = distanceLabel(brief, t);
  const access = accessLabel(brief, t);
  const clientName = brief.client?.name ? cleanName(brief.client.name) : null;
  const clientMeta = [formatRating(null), brief.client?.missionsCount != null ? t('mission.missions_count', { n: brief.client.missionsCount }) : null].filter(Boolean).join(' · ');
  return (
    <View style={fa.grid}>
      <Fact icon={brief.schedule.mode === 'now' ? 'zap' : 'calendar'} main={scheduleLabel(brief, t)} sub={brief.schedule.urgent ? t('mission.surcharge_included') : null} />
      <Fact icon="map-pin" main={dist ?? (placeShort(brief.place.address) ?? '')} sub={dist ? placeShort(brief.place.address) : null} />
      {access || brief.access?.notes ? <Fact icon="home" main={access ?? brief.access?.notes ?? ''} sub={access ? brief.access?.notes ?? null : null} /> : null}
      {clientName ? <Fact icon="user" main={`${clientName}${brief.client?.language ? ` · ${brief.client.language.toUpperCase()}` : ''}`} sub={clientMeta || null} /> : null}
      {brief.description ? <Fact icon="message-square" main={`« ${brief.description.trim()} »`} wide /> : null}
    </View>
  );
}
const fa = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 14 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '47%', flexGrow: 1 },
  wide: { width: '100%' },
  main: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  sub:  { fontFamily: FONTS.sans, fontSize: 11, marginTop: 1 },
});

// ─── Gain ────────────────────────────────────────────────────────────────────
export function EarnRow({ brief, clientView = false }: { brief: MissionBrief; clientView?: boolean }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const quote = isQuoteMode(brief.money.pricingMode ?? brief.service.pricingMode);
  const net = netFor(brief);
  const main = clientView
    ? (brief.money.gross != null && brief.money.gross > 0 ? formatEUR(brief.money.gross, 0) : (brief.money.calloutFee != null ? formatEUR(brief.money.calloutFee, 0) : t('mission.price_tbd')))
    : (net != null ? formatEUR(net, 0) : (brief.money.calloutFee != null ? formatEUR(brief.money.calloutFee, 0) : t('mission.price_tbd')));
  const caption = clientView
    ? t('mission.ttc')
    : net != null && brief.money.gross != null
      ? `${t('mission.net')} · ${t('mission.gross', { amount: formatEUR(brief.money.gross, 0) })}`
      : brief.money.calloutFee != null ? t('mission.callout', { amount: formatEUR(brief.money.calloutFee, 0) }) : '';
  return (
    <View style={[er.row, { borderTopColor: theme.borderLight }]}>
      <Text style={[er.amount, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{main}</Text>
      <Text style={[er.caption, { color: theme.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{caption}</Text>
      <View style={{ flex: 1 }} />
      <View style={[er.mode, { backgroundColor: quote ? 'rgba(200,130,10,0.15)' : 'rgba(21,193,110,0.15)' }]}>
        <Text style={[er.modeText, { color: quote ? COLORS.amber : theme.greenText }]}>{modeLabel(brief, t)}</Text>
      </View>
    </View>
  );
}
const er = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingTop: 12, borderTopWidth: 1 },
  amount:   { fontFamily: FONTS.bebas, fontSize: 30, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  caption:  { fontFamily: FONTS.sans, fontSize: 11.5, flexShrink: 1 },
  mode:     { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  modeText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1 },
});

// ─── Accès (fiche) ───────────────────────────────────────────────────────────
export function AccessBlock({ brief }: { brief: MissionBrief }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (!brief.access) return null;
  const a = brief.access;
  const kind = a.buildingType ? t(`ext.missions_building_${a.buildingType}`) : null;
  const main = [kind, accessLabel(brief, t)].filter(Boolean).join(' · ');
  if (!main && !a.notes) return null;
  return (
    <View style={bl.section}>
      <Text style={[bl.label, { color: theme.textMuted }]}>{t('mission.access').toUpperCase()}</Text>
      <View style={bl.kv}>
        <View style={[bl.ic, { backgroundColor: theme.surface }]}><Feather name="home" size={13} color={theme.textSub as string} /></View>
        <View style={{ flex: 1 }}>
          {main ? <Text style={[bl.main, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{main}</Text> : null}
          {a.notes ? <Text style={[bl.sub, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{a.notes}</Text> : null}
        </View>
      </View>
    </View>
  );
}

// ─── Client / prestataire (fiche) ────────────────────────────────────────────
function Avatar({ name, size = 40 }: { name: string | null; size?: number }) {
  const theme = useAppTheme();
  const initials = (name ?? '?').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13, color: theme.text }}>{initials}</Text>
    </View>
  );
}

function RoundBtn({ icon, onPress, label, primary }: { icon: FeatherName; onPress?: () => void; label: string; primary?: boolean }) {
  const theme = useAppTheme();
  const press = usePressScale();
  if (!onPress) return null;
  return (
    <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[bl.btn, { backgroundColor: primary ? theme.accent : theme.surfaceAlt }, press.style]}>
        <Feather name={icon} size={15} color={(primary ? theme.accentText : theme.text) as string} />
      </Animated.View>
    </Pressable>
  );
}

// Aucun numéro affiché ni composé : on se parle dans l'app (message, appel in-app).
export function ClientBlock({ brief, onMessage, onCall }: { brief: MissionBrief; onMessage?: () => void; onCall?: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (!brief.client?.name) return null;
  const meta = [
    brief.client.missionsCount != null ? t('mission.missions_count', { n: brief.client.missionsCount }) : null,
    brief.client.city,
  ].filter(Boolean).join(' · ');
  return (
    <View style={bl.section}>
      <Text style={[bl.label, { color: theme.textMuted }]}>{t('mission.client').toUpperCase()}</Text>
      <View style={[bl.card, { backgroundColor: theme.surface }]}>
        <Avatar name={brief.client.name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[bl.main, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {cleanName(brief.client.name)}
            {brief.client.language ? <Text style={[bl.flag, { color: theme.textSub }]}>  {brief.client.language.toUpperCase()}</Text> : null}
          </Text>
          {meta ? <Text style={[bl.sub, { color: theme.textSub }]} numberOfLines={1}>{meta}</Text> : null}
          {brief.description ? <Text style={[bl.sub, { color: theme.textSub }]} numberOfLines={2}>« {brief.description.trim()} »</Text> : null}
        </View>
        {onMessage ? <RoundBtn icon="message-circle" onPress={onMessage} label={t('ext.missions_message_client_a11y')} /> : null}
        {onCall ? <RoundBtn icon="phone" onPress={onCall} label={t('missions.call_client_a11y')} primary /> : null}
      </View>
    </View>
  );
}

export function ProviderBlock({ brief, onMessage, onCall }: { brief: MissionBrief; onMessage?: () => void; onCall?: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const p = brief.provider;
  if (!p?.name) return null;
  const meta = [formatRating(p.avgRating), p.missionsCount != null ? t('mission.missions_count', { n: p.missionsCount }) : null].filter(Boolean).join(' · ');
  return (
    <View style={bl.section}>
      <Text style={[bl.label, { color: theme.textMuted }]}>{t('mission.provider').toUpperCase()}</Text>
      <View style={[bl.card, { backgroundColor: theme.surface }]}>
        <Avatar name={p.name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[bl.main, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{cleanName(p.name)}</Text>
          {meta ? <Text style={[bl.sub, { color: theme.textSub }]} numberOfLines={1}>{meta}</Text> : null}
        </View>
        {onMessage ? <RoundBtn icon="message-circle" onPress={onMessage} label={t('ext.missions_message_client_a11y')} /> : null}
        {onCall ? <RoundBtn icon="phone" onPress={onCall} label={t('missions.call_client_a11y')} primary /> : null}
      </View>
    </View>
  );
}

const bl = StyleSheet.create({
  section: { paddingHorizontal: 24 },
  label: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.5, paddingTop: 18, paddingBottom: 8 },
  kv:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ic:    { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  main:  { fontFamily: FONTS.sansMedium, fontSize: 14 },
  sub:   { fontFamily: FONTS.sans, fontSize: 11.5, marginTop: 2 },
  flag:  { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1 },
  card:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  btn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
