// components/request/stepper/DevisInfoModal.tsx
// Fenêtre « Comment fonctionne le devis » de l'étape 4 (flow devis/diagnostic).
import React from 'react';
import { View, Text, Modal, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';
import { useLayoutClass, useSheetFrame, debugSnapshot } from '@/lib/layout';
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
  // Le Modal couvre la fenêtre : sur le Duo déplié, la carte se pose sur une
  // page (20 pt de retrait dedans) ; sur un iPhone, les 20 pt d'origine.
  const page = useSheetFrame({ modal: true });
  // 669 pt de haut déplié, et une page étroite qui allonge les textes : la
  // carte s'arrête à 20 pt des bords sûrs et son contenu défile, « Compris »
  // restant visible en bas. Sur un iPhone le contenu tient : rien ne bouge.
  const { height, insets } = useLayoutClass();
  const maxHeight = Math.max(0, height - insets.top - insets.bottom - 40);
  const steps = [
    { num: '1', title: t('ext.stepper_quote_step1_title'), sub: t('ext.stepper_quote_step1_sub') },
    { num: '2', title: t('ext.stepper_quote_step2_title'), sub: t('ext.stepper_quote_step2_sub') },
    { num: '3', title: t('ext.stepper_quote_step3_title'), sub: t('ext.stepper_quote_step3_sub') },
  ];

  return (
    <Modal onShow={() => debugSnapshot('modal-devis')} visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <PressScale style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingLeft: page.marginLeft + 20, paddingRight: page.marginRight + 20 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
        <PressScale onPress={() => {}} accessible={false}>
          <View style={[dim.sheet, { backgroundColor: theme.card, borderRadius: 24, maxHeight }]}>
            <ScrollView style={{ flexGrow: 0 }}>
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
            </ScrollView>

            <PressScale style={[dim.closeBtn, { backgroundColor: theme.accent }]} onPress={onClose} accessibilityRole="button">
              <Text style={[dim.closeBtnText, { color: theme.accentText, fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 20, letterSpacing: 2 }]}>{t('stepper.understood')}</Text>
            </PressScale>
          </View>
        </PressScale>
      </PressScale>
    </Modal>
  );
}
