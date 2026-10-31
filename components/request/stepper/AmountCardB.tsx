// components/request/stepper/AmountCardB.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated from 'react-native-reanimated';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION, useBreathe, useCountingValue, usePresence } from '@/lib/motion';
import { ReText } from '@/components/ui/ReText';
import { formatPriceDelta, parseEuroAmount } from '@/lib/request/pricing';
import type { StepperTheme } from './useStepperTheme';

/** Carte noire premium : montant héros, filigrane FIXED, pied TVA/HT.
 *  `original` (montant barré) + `savings` (pill verte) → état remise promo. */
export function AmountCardB({
  theme, label, euros, footerLeft, footerRight, original, savings, loading,
}: {
  theme: StepperTheme; label: string; euros: string;
  footerLeft: React.ReactNode; footerRight?: React.ReactNode;
  original?: string; savings?: string; loading?: boolean;
}) {
  // Moment 10 : le montant COMPTE vers sa nouvelle valeur, le bloc respire
  // une fois, et le delta apparaît puis s'efface seul. Aucun toast : le prix
  // qui bouge est le feedback.
  const amount = useMemo(() => parseEuroAmount(euros), [euros]);
  const counter = useCountingValue(amount, { decimals: 2, preset: MOTION.count });
  const breathe = useBreathe();
  const prevRef = useRef(amount);
  const [delta, setDelta] = useState<number | null>(null);
  const deltaPresence = usePresence(delta !== null, { from: 'bottom', preset: MOTION.pane });
  useEffect(() => {
    if (prevRef.current === amount) return;
    const d = amount - prevRef.current;
    prevRef.current = amount;
    breathe.pulse();
    setDelta(d);
    const id = setTimeout(() => setDelta(null), 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- breathe est stable
  }, [amount]);
  return (
    <View
      style={{
        position: 'relative', borderRadius: 26, overflow: 'hidden',
        backgroundColor: theme.heroBg, padding: 22,
        shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 10,
      }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'transparent', 'rgba(0,0,0,0.22)']}
        locations={[0, 0.5, 1]}
        start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: theme.heroSub }}>{label}</Text>
        {savings ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(21,193,110,0.16)', borderWidth: 1, borderColor: 'rgba(21,193,110,0.4)' }}>
            <Feather name="tag" size={11} color={COLORS.green} />
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.5, color: COLORS.green }}>{savings}</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 3, color: theme.heroSubFaint }}>FIXED</Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <Reanimated.View style={[{ flexDirection: 'row', alignItems: 'baseline' }, breathe.style]}>
          <ReText
            animatedProps={counter.animatedProps}
            style={{ fontFamily: FONTS.bebas, fontSize: 54, letterSpacing: 0.5, lineHeight: 56, color: theme.heroText }}
            accessibilityLabel={`${euros} €`}
          />
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, color: theme.heroSub }}> €</Text>
        </Reanimated.View>
        <Reanimated.View style={[{ position: 'absolute', right: 0, top: -18 }, deltaPresence.style]} pointerEvents="none">
          {delta !== null && (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 0.5, color: delta > 0 ? COLORS.amber : COLORS.green }}>
              {formatPriceDelta(delta)}
            </Text>
          )}
        </Reanimated.View>
        {original ? (
          <Text style={{ fontFamily: FONTS.mono, fontSize: 17, color: theme.heroSubFaint, textDecorationLine: 'line-through' }}>
            {original} €
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }}>{footerLeft}</View>
        {footerRight != null ? <View style={{ flexShrink: 0 }}>{footerRight}</View> : null}
      </View>

      {/* Loader pendant l'init du paiement (lock prix + création demande + PaymentSheet) */}
      {loading ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>Préparation du paiement…</Text>
        </View>
      ) : null}
    </View>
  );
}
