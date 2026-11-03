// components/request/stepper/StepPlanning.tsx
// Étape 3 — Planning (planche 3A) : maintenant / planifier, semaine, grille
// horaire, urgence, TVA (âge du logement), infos d'accès.
import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';
import { AdaptiveScroll } from '@/lib/layout';
import { PressScale } from '@/components/ui/PressScale';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StepCTA } from '@/components/request/StepCTA';
import { WeekStrip } from '@/components/request/WeekStrip';
import { SlotGrid } from '@/components/request/SlotGrid';
import { SettingRow } from '@/components/request/SettingRow';
import { isSlotDisabled, type Week, type WeekDay } from '@/lib/scheduling/weeks';
import type { ScheduleMode } from '@/lib/request/schedule';
import { AccessInfoFields, type AccessInfoFieldsProps } from './AccessInfoFields';
import { ai } from './accessStyles';
import type { StepperTheme } from './useStepperTheme';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

type Props = {
  theme: StepperTheme;
  weeks: Week[];
  scheduleMode: ScheduleMode;
  setScheduleMode: SetState<ScheduleMode>;
  selectedDayIso: string | null;
  setSelectedDayIso: SetState<string | null>;
  selectedDay: WeekDay | null;
  selectedTime: string | null;
  setSelectedTime: SetState<string | null>;
  dayLabel: (d: WeekDay) => string;
  monthLabel: (m: number) => string;
  timeGroups: { label: string; slots: string[] }[];
  isUrgent: boolean;
  setIsUrgent: SetState<boolean>;
  isQuoteFlow: boolean;
  vatEligible: boolean;
  vatRate: number;
  buildingOver10y: boolean;
  setBuildingOver10y: SetState<boolean>;
  accessExpanded: boolean;
  setAccessExpanded: SetState<boolean>;
  access: AccessInfoFieldsProps;
  step3Ready: boolean;
  onNext: () => void;
};

export function StepPlanning({
  theme, weeks, scheduleMode, setScheduleMode, selectedDayIso, setSelectedDayIso, selectedDay,
  selectedTime, setSelectedTime, dayLabel, monthLabel, timeGroups, isUrgent, setIsUrgent,
  isQuoteFlow, vatEligible, vatRate, buildingOver10y, setBuildingOver10y, accessExpanded,
  setAccessExpanded, access, step3Ready, onNext,
}: Props) {
  const { t } = useTranslation();
  return (
    <View style={s.flex}>
      <AdaptiveScroll style={s.flex} contentContainerStyle={s.step3Pad} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
        <SegmentedControl
          options={[{ value: 'now', label: t('stepper.now') }, { value: 'later', label: t('stepper.schedule') }]}
          value={scheduleMode}
          onChange={(mode) => {
            if (mode === 'now') { setScheduleMode('now'); setSelectedDayIso(null); setSelectedTime(null); }
            else { setScheduleMode('later'); setIsUrgent(false); }
          }}
        />

        {scheduleMode === 'later' && (
          <>
            <WeekStrip
              weeks={weeks}
              selectedIso={selectedDayIso}
              onSelect={(iso) => { setSelectedDayIso(iso); setSelectedTime(null); }}
              dayLabel={dayLabel}
              monthLabel={monthLabel}
              prevLabel={t('stepper.prev_week')}
              nextLabel={t('stepper.next_week')}
            />
            {selectedDayIso && (
              <SlotGrid
                groups={timeGroups}
                selected={selectedTime}
                onSelect={setSelectedTime}
                isDisabled={(slot) => isSlotDisabled(selectedDayIso, slot, new Date())}
              />
            )}
          </>
        )}

        {/* ── Urgence (mode maintenant) — câblée sur isUrgent : majoration et
               callout urgent calculés côté serveur ── */}
        {scheduleMode === 'now' && (
          <SettingRow
            icon="zap"
            title={t('stepper.urgency_label')}
            subtitle={isQuoteFlow ? t('stepper.urgency_desc_callout') : t('stepper.urgency_desc_surcharge')}
            onPress={() => { feedback.haptic('medium'); setIsUrgent(prev => !prev); }}
            accessibilityRole="switch"
            accessibilityState={{ checked: isUrgent }}
            right={(
              <Switch
                value={isUrgent}
                onValueChange={(v) => { feedback.haptic('medium'); setIsUrgent(v); }}
                trackColor={{ true: COLORS.greenBrand, false: theme.surfaceBorder as string }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.surfaceBorder as string}
              />
            )}
          />
        )}

        {/* ── TVA : âge du logement (détermine 6% vs 21%) ── */}
        {vatEligible && (
          <SettingRow
            icon="percent"
            title={t('stepper.vat_dwelling_title')}
            subtitle={vatRate === 0.06 ? t('stepper.vat_reduced_hint') : t('stepper.vat_standard_hint')}
          >
              <View style={[ai.chipRow, { marginTop: 6 }]}>
                {([
                  { val: true,  label: t('stepper.vat_over10') },
                  { val: false, label: t('stepper.vat_under10') },
                ] as const).map(opt => (
                  <PressScale accessibilityRole="button"
                    key={String(opt.val)}
                    style={[
                      ai.chip,
                      { borderColor: buildingOver10y === opt.val ? theme.accent : theme.surfaceBorder },
                      buildingOver10y === opt.val && { backgroundColor: theme.accent },
                    ]}
                    onPress={() => { feedback.haptic('light'); setBuildingOver10y(opt.val); }}
                  >
                    <Text style={[ai.chipText, { color: buildingOver10y === opt.val ? theme.accentText : theme.textSub }]}>{opt.label}</Text>
                  </PressScale>
                ))}
              </View>
          </SettingRow>
        )}

        {/* ── Infos d'accès (dépliable) ── */}
        <SettingRow
          icon="home"
          title={t('stepper.access_info_title')}
          subtitle={t('stepper.access_info_sub')}
          onPress={() => setAccessExpanded(prev => !prev)}
          accessibilityState={{ expanded: accessExpanded }}
          right={<Feather name={accessExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted as string} />}
        >
          {accessExpanded && <AccessInfoFields {...access} />}
        </SettingRow>

        <View style={{ height: 120 }} />
      </AdaptiveScroll>

      <View style={s.floatingCTA}>
        <StepCTA
          testID="stepper-next-planning"
          label={
            scheduleMode === 'now'
              ? t('stepper.confirm_now')
              : (selectedDayIso && selectedTime
                ? t('stepper.confirm_at', { day: selectedDay ? dayLabel(selectedDay) : '', date: selectedDay?.date ?? '', time: selectedTime })
                : t('stepper.confirm_slot'))
          }
          onPress={onNext}
          disabled={!step3Ready}
          hint={
            scheduleMode === null
              ? t('stepper.hint_choose_mode')
              : !selectedDayIso ? t('stepper.hint_choose_day') : t('stepper.hint_choose_slot')
          }
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  step3Pad:       { paddingHorizontal: 24, paddingTop: 28 },
  floatingCTA:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
