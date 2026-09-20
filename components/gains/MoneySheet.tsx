// components/gains/MoneySheet.tsx — la fiche argent d'une mission : titre,
// trois lignes, chronologie de l'argent (terminée, virement parti, arrive sur
// le compte), facture. Feuille gorhom configurée sur le moteur de mouvement.
import { useHideBar } from '@/stores/nav';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useSheetMotion } from '@/lib/motion/sheet';
import { useAndroidBackClose } from '@/hooks/use-android-back-close';
import { formatClock, formatDay, formatDayShort } from '@/lib/format';
import { ledgerOf, type GainLine } from '@/lib/gains/model';
import { Ledger } from './Ledger';

type Props = { line: GainLine | null; bankLabel: string | null; onClose: () => void; onInvoice?: (missionId: number) => void };

export function MoneySheet({ line, bankLabel, onClose, onInvoice }: Props) {
  useHideBar(!!line); // la barre flottante s'efface tant que la feuille est ouverte
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const motion = useSheetMotion();
  useAndroidBackClose(!!line, onClose);
  const renderBackdrop = useCallback((props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} pressBehavior="close" />, []);
  if (!line) return null;
  const ledger = ledgerOf(line);
  const lang = i18n.language;
  const doneAt = line.tx.mission?.completedAt ?? null;
  const steps: { key: string; label: string; when: string; done: boolean }[] = [
    { key: 'done', label: t('gains.tl_done'), when: doneAt ? `${formatDayShort(doneAt, lang)} ${formatClock(doneAt)}` : '', done: true },
    { key: 'transfer', label: t('gains.tl_transfer'), when: `${formatDayShort(line.tx.createdAt, lang)} ${formatClock(line.tx.createdAt)}`, done: true },
    { key: 'bank', label: bankLabel ? t('gains.tl_bank', { bank: bankLabel }) : t('gains.tl_bank_no_bank'), when: line.arrivesAt ? formatDayShort(line.arrivesAt, lang) : '', done: line.state === 'paid' },
  ];
  return (
    <BottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      animationConfigs={motion.animationConfigs}
      overDragResistanceFactor={motion.overDragResistanceFactor}
      onAnimate={motion.onAnimate}
      handleIndicatorStyle={{ backgroundColor: theme.textDisabled, width: 36, height: 4 }}
      backgroundStyle={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}
    >
      <BottomSheetView style={[s.body, { paddingBottom: insets.bottom + 24 }]}>
        {line.missionId != null ? <Text style={[s.kicker, { color: theme.textMuted }]}>{t('gains.sheet_mission', { id: line.missionId, date: formatDay(line.date, lang).toUpperCase() })}</Text> : null}
        <Text style={[s.title, { color: theme.text }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{[line.title ?? (line.net < 0 ? t('gains.other_debit') : t('gains.other_credit')), line.city].filter(Boolean).join(' · ')}</Text>
        <View style={{ marginTop: 14 }}><Ledger gross={ledger.gross} commission={ledger.commission} rate={ledger.rate} net={ledger.net} tone="bg" /></View>
        {line.state !== 'refunded' ? (
          <View style={s.tl} accessibilityRole="list">
            {steps.map((st) => (
              <View key={st.key} style={s.tlRow} accessible accessibilityLabel={`${st.label} ${st.when}`}>
                <View style={[s.dot, { borderColor: st.done ? theme.greenText : theme.border, backgroundColor: st.done ? theme.greenText : 'transparent' }]} />
                <Text style={[s.tlLabel, { color: st.done ? theme.text : theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{st.label}</Text>
                <Text style={[s.tlWhen, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{st.when.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {line.missionId != null && onInvoice ? (
          <Pressable style={[s.ghost, { borderColor: theme.border }]} onPress={() => onInvoice(line.missionId as number)} accessibilityRole="button" accessibilityLabel={t('gains.view_invoice')}>
            <Feather name="file-text" size={15} color={theme.text as string} />
            <Text style={[s.ghostText, { color: theme.text }]}>{t('gains.view_invoice').toUpperCase()}</Text>
          </Pressable>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 4 },
  kicker: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.5 },
  title: { fontFamily: FONTS.bebas, fontSize: 28, includeFontPadding: false, marginTop: 6 },
  tl: { marginTop: 14, gap: 10 },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  tlLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 12.5 },
  tlWhen: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 0.5 },
  ghost: { marginTop: 16, height: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostText: { fontFamily: FONTS.bebas, fontSize: 16, letterSpacing: 1.5, includeFontPadding: false },
});
