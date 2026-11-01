// components/quote/QuoteFooter.tsx — Footer épinglé : UNE action dominante
// (accepter), refus en lien discret → sheet dédiée.
import React from "react";
import { Text, StyleSheet, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { FONTS, alpha, type AppTheme } from "@/hooks/use-app-theme";
import { formatEURCents as fmtEur } from "@/lib/format";
import { RaisedButton } from "@/components/ui/RaisedButton";
import { PressScale } from '@/components/ui/PressScale';

export function QuoteFooter({
  theme, bottomInset, canAct, accepted, accepting, remainingAmount,
  onLayout, onAccept, onOpenRefuse, onViewMission, onHome,
}: {
  theme: AppTheme;
  bottomInset: number;
  canAct: boolean;
  accepted: boolean;
  accepting: boolean;
  /** Centimes. */
  remainingAmount: number;
  onLayout: (e: LayoutChangeEvent) => void;
  onAccept: () => void;
  onOpenRefuse: () => void;
  onViewMission: () => void;
  onHome: () => void;
}) {
  const { t } = useTranslation();
  return (
    <LinearGradient
      colors={[alpha(theme.bg, 0), theme.bg, theme.bg]}
      locations={[0, 0.45, 1]}
      style={[s.footer, { paddingBottom: Math.max(bottomInset, 12) }]}
      pointerEvents="box-none"
      onLayout={onLayout}
    >
      {canAct ? (
        <>
          <RaisedButton
            display
            size="lg"
            testID="quote-accept"
            label={`${t('quote.accept_cta')} · ${fmtEur(remainingAmount)}`}
            iconRight="arrow-right"
            loading={accepting}
            onPress={onAccept}
            haptic="none"
          />
          <PressScale
            style={s.refuseLink}
            onPress={onOpenRefuse}
            accessibilityRole="button"
            accessibilityLabel={t('quote.refuse_link')}
            hitSlop={8}
          >
            <Text style={[s.refuseLinkText, { color: theme.textSub }]}>{t('quote.refuse_link')}</Text>
          </PressScale>
        </>
      ) : accepted ? (
        <RaisedButton
          display
          size="lg"
          label={t('notifications.cta_view_mission')}
          iconRight="arrow-right"
          onPress={onViewMission}
        />
      ) : (
        <RaisedButton
          display
          size="lg"
          label={t('dashboard.back_home')}
          onPress={onHome}
        />
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  // zIndex (et non elevation) : sur Android RN réordonne le rendu sans dessiner
  // d'ombre — une elevation ici tracerait un liseré sombre sur le dégradé.
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10,
    paddingHorizontal: 18, paddingTop: 28, gap: 4,
  },
  refuseLink: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 16 },
  refuseLinkText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
});
