// components/request/stepper/PromoSheet.tsx
import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TextInput, KeyboardAvoidingView, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';
import { dim } from './dialogStyles';
import type { StepperTheme } from './useStepperTheme';

/** Bottom sheet de saisie d'un code promo (offre de lancement). */
export function PromoSheet({
  visible, onClose, onApply, applying, theme,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (code: string) => void;
  applying: boolean;
  theme: StepperTheme;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  // Reset le champ à chaque ouverture (détectée au rendu, pas dans un effet).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setCode('');
  }

  const canApply = code.trim().length >= 3 && !applying;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <PressScale style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding">
        <PressScale onPress={() => {}}>
          <View style={[dim.sheet, { backgroundColor: theme.card, borderRadius: 24, paddingHorizontal: 24 }]}>
            <View style={dim.titleRow}>
              <View style={[dim.iconWrap, { backgroundColor: 'rgba(21,193,110,0.15)', borderColor: 'rgba(21,193,110,0.3)' }]}>
                <Feather name="tag" size={20} color={theme.greenText} />
              </View>
              <Text style={[dim.title, { color: theme.text }]}>{t('stepper.promo_title') || 'Code promo'}</Text>
            </View>
            <Text style={[dim.subtitle, { color: theme.textSub, marginTop: 8 }]}>
              {t('stepper.promo_subtitle') || 'Saisissez votre code pour bénéficier de l’offre.'}
            </Text>

            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              editable={!applying}
              placeholder="LAUNCH25"
              placeholderTextColor={theme.textMuted as string}
              onSubmitEditing={() => canApply && onApply(code)}
              returnKeyType="done"
              style={{
                marginTop: 20, height: 56, borderRadius: 16, paddingHorizontal: 18,
                backgroundColor: theme.surface as string, borderWidth: 1, borderColor: theme.surfaceBorder as string,
                fontFamily: FONTS.mono, fontSize: 18, letterSpacing: 2, color: theme.text as string,
              }}
            />

            <PressScale
              style={[dim.closeBtn, { backgroundColor: canApply ? theme.accent : (theme.surface as string), marginHorizontal: 0, marginTop: 18, opacity: canApply ? 1 : 0.6 }]}
              onPress={() => canApply && onApply(code)}
              disabled={!canApply}
              accessibilityRole="button"
            >
              {applying ? (
                <ActivityIndicator color={theme.accentText as string} />
              ) : (
                <Text style={{ color: (canApply ? theme.accentText : theme.textMuted) as string, fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 20, letterSpacing: 2 }}>
                  {t('stepper.promo_apply') || 'APPLIQUER'}
                </Text>
              )}
            </PressScale>
          </View>
        </PressScale>
        </KeyboardAvoidingView>
      </PressScale>
    </Modal>
  );
}
