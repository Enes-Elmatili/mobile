// components/settings/FieldSheet.tsx — une feuille, un champ.
// Le clavier est déjà ouvert, une phrase dit à quoi sert le champ, un bouton
// enregistre. Montée seulement quand elle est ouverte (gorhom + Android).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type KeyboardTypeOptions } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetTextInput, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useSheetMotion } from '@/lib/motion/sheet';
import { useAndroidBackClose } from '@/hooks/use-android-back-close';
import { Cta } from '@/components/tracking';
import { BarLock } from '@/stores/nav';

export type FieldSpec = {
  key: string;
  /** Petit titre mono au-dessus (« INFORMATIONS · 2 SUR 4 »). */
  kicker?: string;
  title: string;
  hint?: string;
  value: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  maxLength?: number;
  secure?: boolean;
};

type Props = {
  field: FieldSpec | null;
  onClose: () => void;
  /** Résout quand c'est enregistré ; rejette pour laisser la feuille ouverte. */
  onSave: (key: string, value: string) => Promise<void>;
};

export function FieldSheet({ field, onClose, onSave }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const motion = useSheetMotion();
  const ref = useRef<BottomSheet>(null);
  const [value, setValue] = useState(field?.value ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(field?.value ?? ''); }, [field?.key, field?.value]);
  const close = useCallback(() => { ref.current?.close(); }, []);
  useAndroidBackClose(!!field, close);
  const renderBackdrop = useCallback((p: BottomSheetBackdropProps) => <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.45} />, []);
  if (!field) return null;
  const changed = value.trim() !== (field.value ?? '').trim();
  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    try { await onSave(field.key, value.trim()); ref.current?.close(); } catch { /* la feuille reste ouverte, l'erreur est déjà dite */ } finally { setSaving(false); }
  };
  return (
    <BottomSheet
      ref={ref}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      animationConfigs={motion.animationConfigs}
      overDragResistanceFactor={motion.overDragResistanceFactor}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: theme.textDisabled, width: 36, height: 4 }}
    >
      <BottomSheetView style={[s.body, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <BarLock />
        {field.kicker ? <Text style={[s.kicker, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{field.kicker.toUpperCase()}</Text> : null}
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{field.title}</Text>
        <BottomSheetTextInput
          value={value}
          onChangeText={setValue}
          placeholder={field.placeholder}
          placeholderTextColor={theme.textMuted as string}
          keyboardType={field.keyboardType}
          autoCapitalize={field.autoCapitalize ?? 'sentences'}
          autoFocus
          multiline={field.multiline}
          maxLength={field.maxLength}
          secureTextEntry={field.secure}
          returnKeyType={field.multiline ? 'default' : 'done'}
          onSubmitEditing={field.multiline ? undefined : save}
          style={[s.input, field.multiline && s.inputMulti, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.accent }]}
          accessibilityLabel={field.title}
        />
        {field.hint ? <Text style={[s.hint, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{field.hint}</Text> : null}
        <View style={{ marginTop: 16 }}>
          <Cta label={t('common.save')} onPress={save} disabled={!changed} loading={saving} />
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 4 },
  kicker: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2 },
  title: { fontFamily: FONTS.bebas, fontSize: 26, letterSpacing: 0.5, marginTop: 8, marginBottom: 12, includeFontPadding: false },
  input: { fontFamily: FONTS.sans, fontSize: 16, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  hint: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 17, marginTop: 10 },
});
