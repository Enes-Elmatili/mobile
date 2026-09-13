// components/mission/MissionRow.tsx
// Une seule ligne pour Opportunités, À venir, Historique et la demande du
// client (planche 3A) : vignette de la première photo avec le compteur (sinon
// l'icône de la catégorie), prestation, « créneau · lieu, distance », puces
// mono (URGENT, accès, langue), montant à droite en Bebas tabulaire. Colonne
// heure optionnelle. Glissé droite = accepter, gauche = refuser (opportunités).
import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { formatEUR } from '@/lib/format';
import { cleanName } from '@/lib/displayName';
import { accessLabel, isQuoteMode, netFor, type MissionBrief } from '@/lib/mission/brief';
import { categoryIcon, distanceLabel, placeShort, scheduleLabel, serviceName } from './blocks';
import { photoUri } from './photos';

type Props = {
  brief: MissionBrief;
  onPress: () => void;
  /** Colonne heure (missions à venir). */
  time?: string | null;
  /** Montant à droite : net (prestataire) ou TTC (client). */
  amountMode?: 'net' | 'gross';
  /** Glissés (opportunités seulement). */
  onSwipeAccept?: () => void;
  onSwipeRefuse?: () => void;
  /** Sous-ligne : nom du client (À venir) plutôt que le créneau. */
  showClient?: boolean;
  /** Ligne isolée (carte), sans bordure basse. */
  standalone?: boolean;
};

function SwipeAction({ progress, icon, label, color, align }: { progress: SharedValue<number>; icon: React.ComponentProps<typeof Feather>['name']; label: string; color: string; align: 'left' | 'right' }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value * 1.5), transform: [{ scale: 0.8 + 0.2 * Math.min(1, progress.value) }] }));
  return (
    <View style={[sw.action, align === 'left' ? sw.actionLeft : sw.actionRight]}>
      <Animated.View style={[sw.pill, { backgroundColor: color }, style]}>
        <Feather name={icon} size={16} color="#0A0A0A" />
        <Text style={sw.pillText}>{label}</Text>
      </Animated.View>
    </View>
  );
}

export function MissionRow({ brief, onPress, time, amountMode = 'net', onSwipeAccept, onSwipeRefuse, showClient = false, standalone = false }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const press = usePressScale(0.98);
  const swipeRef = useRef<SwipeableMethods>(null);
  const first = brief.photos[0];
  const quote = isQuoteMode(brief.money.pricingMode ?? brief.service.pricingMode);
  const net = netFor(brief);
  const amount = amountMode === 'gross'
    ? (brief.money.gross ? formatEUR(brief.money.gross, 0) : brief.money.calloutFee != null ? formatEUR(brief.money.calloutFee, 0) : null)
    : (net != null ? (time ? `+${formatEUR(net, 0)}` : formatEUR(net, 0)) : brief.money.calloutFee != null ? formatEUR(brief.money.calloutFee, 0) : null);
  const amountCaption = amountMode === 'gross' ? t('mission.ttc') : (net != null ? t('mission.net') : quote ? t('mission.quote').toLowerCase() : t('mission.price_tbd'));
  const dist = distanceLabel(brief, t);
  const place = placeShort(brief.place.address);
  const subline = showClient && brief.client?.name
    ? [cleanName(brief.client.name), brief.place.address?.split(',')[0]].filter(Boolean).join(' · ')
    : [scheduleLabel(brief, t).replace(` · ${t('mission.urgent')}`, ''), [place, dist ? dist.split(' · ')[0] : null].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const chips: { label: string; hot?: boolean }[] = [];
  if (brief.schedule.urgent) chips.push({ label: t('mission.urgent').toUpperCase(), hot: true });
  const access = accessLabel(brief, t);
  if (access) chips.push({ label: access.toUpperCase() });
  if (brief.client?.language) chips.push({ label: brief.client.language.toUpperCase() });

  const row = (
    <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${serviceName(brief)}, ${subline}`}>
      <Animated.View style={[s.row, standalone ? { backgroundColor: theme.cardBg, borderRadius: 16, marginHorizontal: 16 } : { borderBottomColor: theme.borderLight, borderBottomWidth: 1 }, press.style]}>
        {time ? <Text style={[s.time, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{time}</Text> : null}
        <View style={[s.thumb, { backgroundColor: theme.surface }]}>
          {first ? (
            <>
              <Image source={{ uri: photoUri(first.url) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
              <View style={[s.count, { backgroundColor: theme.accent }]}><Text style={[s.countText, { color: theme.accentText }]}>{brief.photos.length}</Text></View>
            </>
          ) : (
            <Feather name={categoryIcon(brief)} size={20} color={theme.textSub as string} />
          )}
        </View>
        <View style={s.mid}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>{serviceName(brief)}</Text>
          <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{subline}</Text>
          {chips.length ? (
            <View style={s.chips}>
              {chips.map((c) => (
                <View key={c.label} style={[s.chip, { backgroundColor: c.hot ? 'rgba(245,158,11,0.15)' : theme.surface }]}>
                  <Text style={[s.chipText, { color: c.hot ? COLORS.amber : theme.textSub }]}>{c.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={s.right}>
          {amount ? <Text style={[s.amount, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{amount}</Text> : null}
          <Text style={[s.amountCap, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{amountCaption}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );

  if (!onSwipeAccept && !onSwipeRefuse) return row;
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={1.6}
      overshootFriction={8}
      leftThreshold={88}
      rightThreshold={88}
      renderLeftActions={onSwipeAccept ? (progress) => <SwipeAction progress={progress} icon="check" label={t('mission.accept')} color={COLORS.greenBrand} align="left" /> : undefined}
      renderRightActions={onSwipeRefuse ? (progress) => <SwipeAction progress={progress} icon="x" label={t('mission.refuse')} color={COLORS.amber} align="right" /> : undefined}
      onSwipeableWillOpen={() => feedback.haptic('medium')}
      onSwipeableOpen={(direction) => {
        swipeRef.current?.close();
        // La ligne peut disparaître de la liste juste après : on agit au tick
        // suivant, hors du callback du geste (Gesture Handler Android).
        const act = direction === 'left' ? onSwipeAccept : onSwipeRefuse;
        if (act) setTimeout(act, 0);
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

const s = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  time:      { width: 44, textAlign: 'center', fontFamily: FONTS.sansMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
  thumb:     { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'visible', flexShrink: 0 },
  count:     { position: 'absolute', right: -4, bottom: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: FONTS.sansMedium, fontSize: 10 },
  mid:       { flex: 1, minWidth: 0 },
  name:      { fontFamily: FONTS.sansMedium, fontSize: 15 },
  sub:       { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 2 },
  chips:     { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  chip:      { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  chipText:  { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 },
  right:     { alignItems: 'flex-end', flexShrink: 0 },
  amount:    { fontFamily: FONTS.bebas, fontSize: 22, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  amountCap: { fontFamily: FONTS.sans, fontSize: 10.5 },
});

const sw = StyleSheet.create({
  action:      { justifyContent: 'center', width: 120 },
  actionLeft:  { alignItems: 'flex-start', paddingLeft: 20 },
  actionRight: { alignItems: 'flex-end', paddingRight: 20 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18 },
  pillText:    { fontFamily: FONTS.sansMedium, fontSize: 13, color: '#0A0A0A' },
});
