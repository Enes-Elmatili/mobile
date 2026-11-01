// components/quote/QuoteProviderCard.tsx — Prestataire du devis (identité, note,
// missions) + message et appel avant de décider.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, type AppTheme } from "@/hooks/use-app-theme";
import type { RequestParty } from '@/lib/types';
import Avatar from "@/components/ui/Avatar";
import { ProviderRow } from "@/components/tracking";
import { PressScale } from '@/components/ui/PressScale';
import { MonoLabel } from "./primitives";
import { cardStyles, type QuoteCardStyle } from "./card";

export function QuoteProviderCard({ theme, cardStyle, provider, providerName, onOpen, onMessage, onCall }: {
  theme: AppTheme;
  cardStyle: QuoteCardStyle;
  provider: RequestParty;
  providerName: string;
  onOpen: () => void;
  onMessage: () => void;
  onCall: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <PressScale
        style={[cardStyles.card, s.providerCard, cardStyle]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={providerName}
      >
        <Avatar
          size={44}
          name={providerName}
          avatarUrl={provider.avatarUrl}
          verified={provider.validationStatus === 'ACTIVE'}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <MonoLabel color={theme.textMuted}>{t('quote.provider_label')}</MonoLabel>
          <Text style={[s.providerName, { color: theme.text }]} numberOfLines={1}>{providerName}</Text>
          <View style={s.providerMeta}>
            <Feather name="star" size={11} color={theme.textSub} />
            <Text style={[s.providerMetaText, { color: theme.textSub }]}>
              {(provider.avgRating ?? 0) > 0 ? Number(provider.avgRating).toFixed(1) : '—'}
            </Text>
            <Text style={[s.providerMetaText, { color: theme.textVeryMuted }]}>·</Text>
            <Text style={[s.providerMetaText, { color: theme.textSub }]} numberOfLines={1}>
              {t('quote.jobs_count', { count: provider.jobsCompleted || 0 })}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={theme.textMuted} />
      </PressScale>
      {/* Message et appel : le prestataire a accepté, on peut lui parler avant de décider. */}
      <View style={{ marginTop: 8 }}>
        <ProviderRow provider={provider} onMessage={onMessage} onCall={onCall} />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  providerCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  providerName: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  providerMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  providerMetaText: { fontFamily: FONTS.monoMedium, fontSize: 11.5, flexShrink: 1 },
});
