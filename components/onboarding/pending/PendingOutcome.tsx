// components/onboarding/pending/PendingOutcome.tsx — layouts centrés : validé / refusé / suspendu / banni
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, COLORS } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";
import { feedback } from "@/lib/feedback/feedback";
import { PressScale } from '@/components/ui/PressScale';
import { outcomeContent, type PendingStatus } from "@/lib/onboarding/pendingDossier";
import { C, ps } from "./pendingTheme";

interface Props {
  status: Exclude<PendingStatus, "pending">;
  rejectionReason: string | null;
  successStyle: React.ComponentProps<typeof Animated.View>["style"];
  onGoLive: () => void;
  onNavigate: (route: string) => void;
}

function CtaArrow() {
  return (
    <View style={ps.arrowPill}>
      <Feather name="arrow-right" size={14} color={C.white} />
    </View>
  );
}

export function PendingOutcome({ status, rejectionReason, successStyle, onGoLive, onNavigate }: Props) {
  const { t } = useTranslation();

  if (status === "approved") {
    return (
      <>
        <Animated.View style={[s.successCircle, successStyle]}>
          <Feather name="check" size={40} color={C.bg} />
        </Animated.View>
        <Text style={s.kickerCenter}>{t('onboarding.approved_kicker')}</Text>
        <Text style={s.title}>
          {t('onboarding.approved_title_l1')}{"\n"}
          <Text style={ps.titleOutline}>{t('onboarding.approved_title_l2')}</Text>
        </Text>
        <Text style={s.subtitle}>{t('onboarding.approved_sub')}</Text>
        <PressScale accessibilityRole="button"
          style={ps.stripeCta}
          onPress={() => {
            feedback.haptic('medium');
            onGoLive();
          }}
        >
          <Text style={ps.stripeCtaText}>{t('onboarding.approved_cta')}</Text>
          <CtaArrow />
        </PressScale>
      </>
    );
  }

  const c = outcomeContent(status);
  // Clé = statut : un changement de statut remonte le bloc, comme avant
  // (chaque statut avait sa propre branche conditionnelle).
  return (
    <React.Fragment key={status}>
      <View style={s.iconCircle}>
        <Feather name={c.icon} size={40} color={c.tone === "red" ? C.red : C.white} />
      </View>
      <Text style={s.title}>
        {t(c.titleL1)}{"\n"}
        <Text style={ps.titleOutline}>{t(c.titleL2)}</Text>
      </Text>
      <Text style={s.subtitle}>{t(c.sub)}</Text>
      {!!rejectionReason && (
        <View style={s.reasonCard}>
          <Text style={s.reasonLabel}>{t(c.reasonLabel)}</Text>
          <Text style={s.reasonText}>{rejectionReason}</Text>
        </View>
      )}
      <PressScale accessibilityRole="button"
        style={ps.stripeCta}
        onPress={() => {
          feedback.haptic('medium');
          onNavigate(c.route);
        }}
      >
        <Text style={ps.stripeCtaText}>{t(c.cta)}</Text>
        <CtaArrow />
      </PressScale>
    </React.Fragment>
  );
}

const s = StyleSheet.create({
  kickerCenter: {
    fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 2.6,
    color: C.grey, textTransform: "uppercase",
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  successCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.white,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 36, color: C.white,
    letterSpacing: 1, lineHeight: 40, textAlign: "center",
  },
  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 15, color: C.grey,
    textAlign: "center", lineHeight: 22, paddingHorizontal: 8,
  },
  // Motif de refus (affiché au prestataire pour qu'il sache quoi corriger)
  reasonCard: {
    width: "100%", backgroundColor: C.cardBg,
    borderWidth: 1, borderColor: alpha(COLORS.red, 0.3),
    borderRadius: 16, padding: 16, gap: 6, marginTop: 4,
  },
  reasonLabel: {
    fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.8,
    color: C.red, textTransform: "uppercase",
  },
  reasonText: {
    fontFamily: FONTS.sans, fontSize: 14, color: C.white, lineHeight: 20,
  },
});
