// components/onboarding/pending/PendingPrepSection.tsx — « En attendant : complétez votre profil »
import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS } from "@/hooks/use-app-theme";
import { PulseDot } from '@/components/ui/PulseDot';
import { PressScale } from '@/components/ui/PressScale';
import { C } from "./pendingTheme";

interface Props {
  hasPhoto: boolean;
  photoBusy: boolean;
  onAddPhoto: () => void;
  hasBio: boolean;
  bioOpen: boolean;
  onToggleBio: () => void;
  bioDraft: string;
  onChangeBioDraft: (v: string) => void;
  bioSaving: boolean;
  onSaveBio: () => void;
}

export function PendingPrepSection(p: Props) {
  const { t } = useTranslation();
  const { hasPhoto, hasBio, bioOpen } = p;
  return (
    <>
      <Text style={s.prepTitle}>{t('onboarding.pending_prep_title')}</Text>
      <View style={s.prepList}>
        <PressScale accessibilityRole="button"
          style={s.prepRow}
          onPress={p.onAddPhoto}
          disabled={p.photoBusy || hasPhoto}
        >
          <Feather name="camera" size={16} color={hasPhoto ? C.green : C.white} />
          <Text style={s.prepLabel}>{t('onboarding.pending_prep_photo')}</Text>
          {p.photoBusy ? (
            <PulseDot size={5} />
          ) : (
            <Feather name={hasPhoto ? "check" : "chevron-right"} size={14} color={hasPhoto ? C.green : C.faint} />
          )}
        </PressScale>

        <PressScale accessibilityRole="button"
          style={s.prepRow}
          onPress={p.onToggleBio}
          disabled={hasBio && !bioOpen}
        >
          <Feather name="file-text" size={16} color={hasBio ? C.green : C.white} />
          <Text style={s.prepLabel}>{t('onboarding.pending_prep_bio')}</Text>
          <Feather
            name={hasBio ? "check" : bioOpen ? "chevron-down" : "chevron-right"}
            size={14}
            color={hasBio ? C.green : C.faint}
          />
        </PressScale>

        {bioOpen && !hasBio && (
          <View style={s.bioCard}>
            <TextInput
              style={s.bioInput}
              value={p.bioDraft}
              onChangeText={p.onChangeBioDraft}
              placeholder={t('onboarding.pending_prep_bio_placeholder')}
              placeholderTextColor={C.faint}
              multiline
              maxLength={500}
            />
            <PressScale accessibilityRole="button"
              style={[s.bioSave, p.bioSaving && { opacity: 0.5 }]}
              onPress={p.onSaveBio}
              disabled={p.bioSaving}
              hitSlop={{ top: 6, bottom: 6 }}
            >
              <Text style={s.bioSaveText}>
                {p.bioSaving ? t('common.loading') : t('common.save')}
              </Text>
            </PressScale>
          </View>
        )}
      </View>
      <View style={s.prepHintRow}>
        <Feather name="zap" size={12} color={C.faint} />
        <Text style={s.prepHint}>{t('onboarding.pending_prep_hint')}</Text>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  prepTitle: {
    fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.8,
    color: C.grey, textTransform: "uppercase", marginBottom: 10,
  },
  prepList: { gap: 9 },
  prepRow: {
    flexDirection: "row", alignItems: "center", gap: 13,
    paddingVertical: 13, paddingHorizontal: 16,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 14,
  },
  prepLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 12.5, color: C.white },
  bioCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 12, gap: 10,
  },
  bioInput: {
    minHeight: 88, fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19,
    color: C.white, textAlignVertical: "top",
  },
  bioSave: {
    alignSelf: "flex-end", paddingHorizontal: 18, height: 38, borderRadius: 10,
    backgroundColor: C.white, alignItems: "center", justifyContent: "center",
  },
  bioSaveText: { fontFamily: FONTS.sansMedium, fontSize: 12.5, color: C.bg },
  prepHintRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
  },
  prepHint: { fontFamily: FONTS.sansLight, fontSize: 11, color: C.faint },
});
