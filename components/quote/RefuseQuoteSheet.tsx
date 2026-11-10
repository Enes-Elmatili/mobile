// components/quote/RefuseQuoteSheet.tsx — Sheet de refus : sortie du flux de
// lecture, action destructive isolée.
import React from "react";
import { View, Text, StyleSheet, Platform, TextInput, KeyboardAvoidingView, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, COLORS, alpha, type AppTheme } from "@/hooks/use-app-theme";
import { RaisedButton } from "@/components/ui/RaisedButton";
import { PressScale } from '@/components/ui/PressScale';
import { useSheetFrame, debugSnapshot } from '@/lib/layout';
import { MonoLabel } from "./primitives";

export function RefuseQuoteSheet({
  theme, visible, bottomInset, reason, onChangeReason, refusing, onClose, onConfirm,
}: {
  theme: AppTheme;
  visible: boolean;
  bottomInset: number;
  reason: string;
  onChangeReason: (text: string) => void;
  refusing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  // Le Modal couvre la fenêtre : sur le Duo déplié, la feuille tient sur une
  // page (ni sous le rail, ni à cheval sur le pli) ; sur un iPhone, pleine largeur.
  const page = useSheetFrame({ modal: true });
  return (
    <Modal onShow={() => debugSnapshot('modal-refuse')}
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* behavior="padding" sur LES DEUX plateformes : avec l'edge-to-edge SDK 54,
          adjustResize est inopérant sur Android — `undefined` laisserait le champ
          « raison » derrière le clavier. */}
      <KeyboardAvoidingView style={s.modalRoot} behavior="padding">
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: alpha('#000000', 0.55) }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[
          s.sheet,
          {
            backgroundColor: theme.cardBg,
            marginLeft: page.marginLeft,
            marginRight: page.marginRight,
            paddingBottom: Math.max(bottomInset + 12, Platform.OS === "ios" ? 40 : 28),
          },
        ]}>
          <View style={[s.sheetHandle, { backgroundColor: theme.border }]} />

          <View style={[s.sheetIcon, { backgroundColor: alpha(COLORS.red, 0.12) }]}>
            <Feather name="x" size={20} color={COLORS.red} />
          </View>

          <Text style={[s.sheetTitle, { color: theme.text }]}>{t('quote.refuse_sheet_title')}</Text>
          <Text style={[s.sheetBody, { color: theme.textSub }]}>{t('quote.refuse_sheet_body')}</Text>

          <View style={{ width: "100%", gap: 8 }}>
            <MonoLabel color={theme.textMuted}>{t('quote.refuse_reason_label')}</MonoLabel>
            <TextInput
              style={[s.refuseInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder={t('quote.refuse_reason_placeholder')}
              placeholderTextColor={theme.textMuted}
              value={reason}
              onChangeText={onChangeReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={300}
            />
          </View>

          <View style={s.sheetBtns}>
            <PressScale
              style={[s.sheetCancel, { borderColor: theme.border }]}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={[s.sheetCancelText, { color: theme.textSub }]}>{t('common.cancel')}</Text>
            </PressScale>
            <RaisedButton
              variant="destructive"
              size="md"
              label={t('quote.confirm_refusal')}
              loading={refusing}
              onPress={onConfirm}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 10, gap: 14, alignItems: "center",
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, marginBottom: 6 },
  sheetIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  sheetTitle: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 26, letterSpacing: 1, textAlign: "center",
  },
  sheetBody: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: -6 },
  refuseInput: {
    borderRadius: 14, borderWidth: 1, padding: 12, minHeight: 84, width: "100%",
    fontFamily: FONTS.sans, fontSize: 13.5,
  },
  sheetBtns: { flexDirection: "row", gap: 10, width: "100%", alignItems: "center" },
  sheetCancel: {
    flex: 1, height: 44, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  sheetCancelText: { fontFamily: FONTS.sansMedium, fontSize: 14 },
});
