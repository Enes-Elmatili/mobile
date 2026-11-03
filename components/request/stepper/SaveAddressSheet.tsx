// components/request/stepper/SaveAddressSheet.tsx
// Feuille « Nommer cette adresse » : raccourcis Domicile / Bureau / Autre,
// nom libre, enregistrement (POST /addresses, côté écran).
import React from 'react';
import { View, Text, Pressable, TextInput, KeyboardAvoidingView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';
import type { StepperTheme } from './useStepperTheme';

type Props = {
  theme: StepperTheme;
  address: string | undefined;
  saveLabel: string;
  setSaveLabel: (label: string) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export function SaveAddressSheet({ theme, address, saveLabel, setSaveLabel, saving, onClose, onSave }: Props) {
  const { t } = useTranslation();
  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100,
    }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ flex: 1 }} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding">
      <View style={{
        backgroundColor: theme.card as string, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40,
        borderTopWidth: 1, borderTopColor: theme.cardBorder as string,
      }}>
        {/* Handle */}
        <View style={{ width: 40, height: 4, backgroundColor: theme.sep as string, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

        {/* Title */}
        <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, color: theme.text as string, letterSpacing: 1, marginBottom: 6 }}>
          {t('stepper.name_this_address')}
        </Text>
        <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.textMuted as string, marginBottom: 20 }} numberOfLines={1}>
          {address || ''}
        </Text>

        {/* Quick chips with icons */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <PressScale accessibilityRole="button"
            onPress={() => setSaveLabel('Domicile')}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
              backgroundColor: saveLabel === 'Domicile' ? (theme.accent as string) : (theme.surface as string),
              borderWidth: 1, borderColor: saveLabel === 'Domicile' ? (theme.accent as string) : (theme.surfaceBorder as string),
            }}
          >
            <Feather name="home" size={14} color={saveLabel === 'Domicile' ? (theme.accentText as string) : (theme.text as string)} />
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Domicile' ? (theme.accentText as string) : (theme.text as string) }}>{t('addresses.label_home')}</Text>
          </PressScale>
          <PressScale accessibilityRole="button"
            onPress={() => setSaveLabel('Bureau')}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
              backgroundColor: saveLabel === 'Bureau' ? (theme.accent as string) : (theme.surface as string),
              borderWidth: 1, borderColor: saveLabel === 'Bureau' ? (theme.accent as string) : (theme.surfaceBorder as string),
            }}
          >
            <Feather name="briefcase" size={14} color={saveLabel === 'Bureau' ? (theme.accentText as string) : (theme.text as string)} />
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Bureau' ? (theme.accentText as string) : (theme.text as string) }}>{t('addresses.label_work')}</Text>
          </PressScale>
          <PressScale accessibilityRole="button"
            onPress={() => setSaveLabel('Autre')}
            style={{
              paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
              backgroundColor: saveLabel === 'Autre' ? (theme.accent as string) : (theme.surface as string),
              borderWidth: 1, borderColor: saveLabel === 'Autre' ? (theme.accent as string) : (theme.surfaceBorder as string),
            }}
          >
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: saveLabel === 'Autre' ? (theme.accentText as string) : (theme.text as string) }}>{t('addresses.label_other')}</Text>
          </PressScale>
        </View>

        {/* Custom input */}
        <TextInput
          value={saveLabel}
          onChangeText={setSaveLabel}
          placeholder={t('stepper.custom_name_placeholder')}
          placeholderTextColor={theme.textMuted as string}
          style={{
            fontFamily: FONTS.sans, fontSize: 15, color: theme.text as string,
            backgroundColor: theme.surface as string, borderRadius: 12,
            borderWidth: 1, borderColor: theme.surfaceBorder as string,
            paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
          }}
          maxLength={50}
        />

        {/* Save CTA */}
        <PressScale accessibilityRole="button"
          onPress={onSave}
          disabled={!saveLabel.trim() || saving}
          style={{
            backgroundColor: theme.accent as string, borderRadius: 16, height: 52,
            alignItems: 'center', justifyContent: 'center',
            opacity: !saveLabel.trim() || saving ? 0.4 : 1,
          }}
        >
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 16, color: theme.accentText as string }}>
            {saving ? t('common.saving') : t('addresses.save_address')}
          </Text>
        </PressScale>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}
