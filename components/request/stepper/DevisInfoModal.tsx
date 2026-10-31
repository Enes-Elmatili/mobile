// components/request/stepper/DevisInfoModal.tsx
// Fenêtre « Comment fonctionne le devis » de l'étape 4 (flow devis/diagnostic).
import React from 'react';
import { View, Text, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';
import { dim } from './dialogStyles';
import type { StepperTheme } from './useStepperTheme';

// ─── Devis Info Modal ────────────────────────────────────────────────────────
export function DevisInfoModal({ visible, onClose, pricingMode, theme }: {
  visible: boolean;
  onClose: () => void;
  pricingMode: string;
  theme: StepperTheme;
}) {
  const { t } = useTranslation();
  const steps = [
    { num: '1', title: t('ext.stepper_quote_step1_title'), sub: t('ext.stepper_quote_step1_sub') },
    { num: '2', title: t('ext.stepper_quote_step2_title'), sub: t('ext.stepper_quote_step2_sub') },
    { num: '3', title: t('ext.stepper_quote_step3_title'), sub: t('ext.stepper_quote_step3_sub') },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <PressScale style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }} onPress={onClose}>
        <PressScale onPress={() => {}}>
          <View style={[dim.sheet, { backgroundColor: theme.card, borderRadius: 24 }]}>

            {/* Header */}
            <View style={dim.header}>
              <View style={dim.titleRow}>
                <View style={dim.iconWrap}>
                  <Feather name={pricingMode === 'diagnostic' ? 'search' : 'file-text'} size={20} color={COLORS.amber} />
                </View>
                <Text style={[dim.title, { color: theme.text }]}>
                  {pricingMode === 'diagnostic' ? t('stepper.onsite_diagnostic') : t('stepper.onsite_estimate')}
                </Text>
              </View>
              <Text style={[dim.subtitle, { color: theme.textSub }]}>
                {t('stepper.onsite_desc')}
              </Text>
            </View>

            <View style={[dim.divider, { backgroundColor: theme.sep }]} />

            {/* Steps */}
            <View style={dim.steps}>
              {steps.map((item, i) => (
                <View key={i} style={dim.stepRow}>
                  {/* Colonne gauche : numéro + connecteur */}
                  <View style={dim.stepLeft}>
                    <View style={[dim.numCircle, {
                      backgroundColor: i === 0 ? 'rgba(200,130,10,0.2)' : theme.surface,
                      borderColor:     i === 0 ? 'rgba(200,130,10,0.5)' : theme.sep,
                    }]}>
                      <Text style={[dim.numText, { color: i === 0 ? COLORS.amber : theme.textSub }]}>{item.num}</Text>
                    </View>
                    {i < steps.length - 1 && <View style={[dim.connector, { backgroundColor: theme.sep }]} />}
                  </View>
                  {/* Contenu */}
                  <View style={[dim.stepContent, i < steps.length - 1 && { paddingBottom: 24 }]}>
                    <Text style={[dim.stepTitle, { color: i === 0 ? COLORS.amber : theme.text }]}>{item.title}</Text>
                    <Text style={[dim.stepSub, { color: theme.textMuted as string }]}>{item.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            <PressScale style={[dim.closeBtn, { backgroundColor: theme.accent }]} onPress={onClose} accessibilityRole="button">
              <Text style={[dim.closeBtnText, { color: theme.accentText, fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 20, letterSpacing: 2 }]}>{t('stepper.understood')}</Text>
            </PressScale>
          </View>
        </PressScale>
      </PressScale>
    </Modal>
  );
}
