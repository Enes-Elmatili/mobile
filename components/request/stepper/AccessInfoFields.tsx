// components/request/stepper/AccessInfoFields.tsx
// Infos d'accès de l'étape 3 (dépliable) : type de bâtiment, étage,
// ascenseur, consignes d'accès, langue préférée.
import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { PressScale } from '@/components/ui/PressScale';
import { ai } from './accessStyles';
import type { StepperTheme } from './useStepperTheme';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export type AccessInfoFieldsProps = {
  theme: StepperTheme;
  buildingType: string | null;
  setBuildingType: SetState<string | null>;
  floorNum: string;
  setFloorNum: (v: string) => void;
  hasElevator: boolean | null;
  setHasElevator: SetState<boolean | null>;
  accessNotes: string;
  setAccessNotes: (v: string) => void;
  clientLanguage: string | null;
  setClientLanguage: SetState<string | null>;
};

export function AccessInfoFields({
  theme, buildingType, setBuildingType, floorNum, setFloorNum, hasElevator, setHasElevator,
  accessNotes, setAccessNotes, clientLanguage, setClientLanguage,
}: AccessInfoFieldsProps) {
  const { t } = useTranslation();
  return (
    <View style={ai.body}>
      {/* Type de bâtiment */}
      <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.building_type')}</Text>
      <View style={ai.chipRow}>
        {([
          { key: 'apartment', label: 'stepper.building_apartment', icon: 'layers' },
          { key: 'house',     label: 'stepper.building_house',     icon: 'home' },
          { key: 'office',    label: 'stepper.building_office',    icon: 'briefcase' },
        ] as const).map(bt => (
          <PressScale accessibilityRole="button"
            key={bt.key}
            style={[
              ai.chip,
              { borderColor: buildingType === bt.key ? theme.accent : theme.surfaceBorder },
              buildingType === bt.key && { backgroundColor: theme.accent },
            ]}
            onPress={() => setBuildingType(prev => prev === bt.key ? null : bt.key)}
          >
            <Feather name={bt.icon} size={14} color={buildingType === bt.key ? theme.accentText as string : theme.textSub as string} />
            <Text style={[ai.chipText, { color: buildingType === bt.key ? theme.accentText : theme.textSub }]}>{t(bt.label)}</Text>
          </PressScale>
        ))}
      </View>

      {/* Étage + Ascenseur */}
      <View style={ai.inlineRow}>
        <View style={{ flex: 1 }}>
          <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.floor')}</Text>
          <View style={[ai.inputWrap, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Feather name="arrow-up" size={14} color={theme.textMuted as string} />
            <TextInput
              style={[ai.input, { color: theme.text }]}
              value={floorNum}
              onChangeText={setFloorNum}
              placeholder={t('stepper.floor_placeholder')}
              placeholderTextColor={theme.textMuted as string}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.elevator')}</Text>
          <View style={ai.chipRow}>
            <PressScale accessibilityRole="button"
              style={[ai.chip, { borderColor: hasElevator === true ? theme.accent : theme.surfaceBorder }, hasElevator === true && { backgroundColor: theme.accent }]}
              onPress={() => setHasElevator(prev => prev === true ? null : true)}
            >
              <Feather name="check" size={14} color={hasElevator === true ? theme.accentText as string : theme.textSub as string} />
              <Text style={[ai.chipText, { color: hasElevator === true ? theme.accentText : theme.textSub }]}>{t('common.yes')}</Text>
            </PressScale>
            <PressScale accessibilityRole="button"
              style={[ai.chip, { borderColor: hasElevator === false ? theme.accent : theme.surfaceBorder }, hasElevator === false && { backgroundColor: theme.accent }]}
              onPress={() => setHasElevator(prev => prev === false ? null : false)}
            >
              <Feather name="x" size={14} color={hasElevator === false ? theme.accentText as string : theme.textSub as string} />
              <Text style={[ai.chipText, { color: hasElevator === false ? theme.accentText : theme.textSub }]}>{t('common.no')}</Text>
            </PressScale>
          </View>
        </View>
      </View>

      {/* Notes d'accès */}
      <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.access_instructions')}</Text>
      <View style={[ai.textareaWrap, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <TextInput
          style={[ai.textarea, { color: theme.text }]}
          value={accessNotes}
          onChangeText={setAccessNotes}
          placeholder={t('stepper.access_placeholder')}
          placeholderTextColor={theme.textMuted as string}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
      </View>

      {/* Langue */}
      <Text style={[ai.label, { color: theme.textMuted }]}>{t('stepper.preferred_language')}</Text>
      <View style={ai.chipRow}>
        {([
          { key: 'fr', label: 'Français' },
          { key: 'nl', label: 'Nederlands' },
          { key: 'en', label: 'English' },
          { key: 'pl', label: 'Polski' },
        ] as const).map(lang => (
          <PressScale accessibilityRole="button"
            key={lang.key}
            style={[
              ai.chip,
              { borderColor: clientLanguage === lang.key ? theme.accent : theme.surfaceBorder },
              clientLanguage === lang.key && { backgroundColor: theme.accent },
            ]}
            onPress={() => setClientLanguage(prev => prev === lang.key ? null : lang.key)}
          >
            <Text style={[ai.chipText, { color: clientLanguage === lang.key ? theme.accentText : theme.textSub }]}>{lang.label}</Text>
          </PressScale>
        ))}
      </View>
    </View>
  );
}
