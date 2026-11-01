// components/onboarding/pending/PendingFooter.tsx — CTA de reprise / Stripe, rappel notif, déconnexion
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";
import { feedback } from "@/lib/feedback/feedback";
import { PressScale } from '@/components/ui/PressScale';
import { C, ps } from "./pendingTheme";

/** Lien de déconnexion, commun aux deux variantes de l'écran. */
export function PendingLogoutButton({ bottomInset, onSignOut }: { bottomInset: number; onSignOut: () => void }) {
  const { t } = useTranslation();
  return (
    <PressScale accessibilityRole="button"
      style={[s.logoutBtn, { paddingBottom: bottomInset + 16 }]}
      onPress={() => {
        feedback.haptic('light');
        onSignOut();
      }}
    >
      <Feather name="log-out" size={16} color={C.grey} />
      <Text style={s.logoutText}>{t('onboarding.signout')}</Text>
    </PressScale>
  );
}

interface Props {
  fileIncomplete: boolean;
  stripeConnected: boolean;
  onResume: () => void;
  onStripe: (haptic: 'medium' | 'light') => void;
  bottomInset: number;
  onSignOut: () => void;
}

export function PendingFooter({ fileIncomplete, stripeConnected, onResume, onStripe, bottomInset, onSignOut }: Props) {
  const { t } = useTranslation();
  return (
    <View style={ps.footer}>
      {fileIncomplete ? (
        <PressScale
          style={ps.stripeCta}
          onPress={onResume}
          accessibilityRole="button"
        >
          <Text style={ps.stripeCtaText}>{t('onboarding.pending_incomplete_cta')}</Text>
          <View style={ps.arrowPill}>
            <Feather name="arrow-right" size={14} color={C.white} />
          </View>
        </PressScale>
      ) : !stripeConnected ? (
        <PressScale accessibilityRole="button"
          style={ps.stripeCta}
          onPress={() => onStripe('medium')}
        >
          <Text style={ps.stripeCtaText}>{t('onboarding.stripe_cta')}</Text>
          <View style={ps.arrowPill}>
            <Feather name="arrow-right" size={14} color={C.white} />
          </View>
        </PressScale>
      ) : null}

      {/* Stripe reste accessible en second rang tant qu'il manque des pièces :
          on ne retire rien, on ne fait que remettre l'ordre. */}
      {fileIncomplete && !stripeConnected && (
        <PressScale accessibilityRole="button"
          style={s.secondaryLink}
          onPress={() => onStripe('light')}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={s.secondaryLinkText}>{t('onboarding.stripe_cta')}</Text>
        </PressScale>
      )}

      <View style={s.notifRow}>
        <Feather name="bell" size={13} color={C.grey} />
        <Text style={s.notifText}>{t('onboarding.pending_notification')}</Text>
      </View>

      <PendingLogoutButton bottomInset={bottomInset} onSignOut={onSignOut} />
    </View>
  );
}

const s = StyleSheet.create({
  secondaryLink: { alignItems: "center", paddingVertical: 6 },
  secondaryLinkText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    color: C.grey,
    textDecorationLine: "underline",
  },
  notifRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  notifText: {
    fontFamily: FONTS.sansLight, fontSize: 12, color: C.grey,
  },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingTop: 8,
  },
  logoutText: {
    fontFamily: FONTS.sans, fontSize: 14, color: C.grey,
    textDecorationLine: "underline", textDecorationColor: alpha(darkTokens.text, 0.12),
  },
});
