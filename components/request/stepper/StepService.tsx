// components/request/stepper/StepService.tsx
// Étape 2 — Service (planche 2A) : rail de catégories, lignes de prestation
// sans montant, photos guidées sous la prestation choisie, note libre.
import React from 'react';
import { View, Text, TextInput, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18nInstance from '@/lib/i18n';
import { FONTS } from '@/hooks/use-app-theme';
import { translateCategory, translateSubcategory, translateSubcategoryDescription } from '@/lib/categoryLabel';
import { AdaptiveScroll } from '@/lib/layout';
import { Skeleton } from '@/components/ui/Skeleton';
import { PressScale } from '@/components/ui/PressScale';
import { StepCTA } from '@/components/request/StepCTA';
import { StepPager, type PagerDirection } from '@/components/request/StepPager';
import { CategoryRail } from '@/components/request/CategoryRail';
import { ServiceRow } from '@/components/request/ServiceRow';
import { ShotStrip } from '@/components/request/ShotStrip';
import type { ShotSpec } from '@/constants/photoGuides';
import type { LocalShot } from '@/lib/request/photos';
import type { StepperCategory } from '@/lib/request/stepperTypes';
import type { StepperTheme } from './useStepperTheme';

type Props = {
  theme: StepperTheme;
  /** Inset haut + en-tête mesuré : offset exact du KeyboardAvoidingView (iOS). */
  keyboardOffset: number;
  categories: StepperCategory[];
  categoryId: number | null;
  /** Change de catégorie et oublie la prestation choisie. */
  onSelectCategory: (id: number) => void;
  railDirection: PagerDirection;
  selectedCategory: StepperCategory | null;
  subcategoryId: number | null;
  setSubcategoryId: (id: number) => void;
  shotSpecs: ShotSpec[];
  shots: LocalShot[];
  openCamera: (fromKey: string | null) => void;
  removeFreeShot: (index: number) => void;
  categoryUnavailable: boolean;
  noteOpen: boolean;
  setNoteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  description: string;
  setDescription: (text: string) => void;
  isQuoteFlow: boolean;
  serviceChosen: boolean;
  missingShots: ShotSpec[];
  onNext: () => void;
};

export function StepService({
  theme, keyboardOffset, categories, categoryId, onSelectCategory, railDirection,
  selectedCategory, subcategoryId, setSubcategoryId, shotSpecs, shots, openCamera,
  removeFreeShot, categoryUnavailable, noteOpen, setNoteOpen, description,
  setDescription, isQuoteFlow, serviceChosen, missingShots, onNext,
}: Props) {
  const { t } = useTranslation();
  return (
    <KeyboardAvoidingView style={s.flex} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}>
      <View style={s.flex}>
        {categories.length === 0 ? (
          <View style={s.skeletons}>
            <Skeleton h={40} r={20} />
            <Skeleton h={62} r={14} />
            <Skeleton h={62} r={14} />
            <Skeleton h={62} r={14} />
          </View>
        ) : (
          <>
            <CategoryRail
              items={categories.map((c) => ({ id: c.id, label: translateCategory(t, c), testID: c.slug ? `category-${c.slug}` : undefined }))}
              selectedId={categoryId}
              onSelect={onSelectCategory}
            />
            <StepPager page={categoryId ?? 'none'} direction={railDirection} style={s.flex} render={() => (
              <AdaptiveScroll style={s.flex} contentContainerStyle={s.step2Pad} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {(selectedCategory?.subcategories ?? []).map((sub) => (
                  <React.Fragment key={sub.id}>
                    <ServiceRow
                      label={translateSubcategory(i18nInstance.language, sub)}
                      description={translateSubcategoryDescription(i18nInstance.language, sub, t)}
                      pricingMode={sub.pricingMode}
                      selected={subcategoryId === sub.id}
                      onPress={() => setSubcategoryId(sub.id)}
                      fixedLabel={t('stepper.pricing_fixed')}
                      quoteLabel={t('stepper.pricing_quote')}
                      testID={sub.slug ? `service-${sub.slug}` : undefined}
                    />
                    {subcategoryId === sub.id && (
                      <ShotStrip specs={shotSpecs} shots={shots} onTake={openCamera} onRemoveFree={removeFreeShot} />
                    )}
                  </React.Fragment>
                ))}
                {/* Catégorie sans prestation ET sans prix : non réservable (aucun prix à
                    verrouiller). On l'annonce au lieu de laisser le parcours mener à une
                    erreur de paiement à l'étape 4. */}
                {categoryUnavailable && (
                  <Text style={[s.unavailable, { color: theme.textSub }]}>{t('stepper.service_unavailable')}</Text>
                )}

                <PressScale style={s.noteToggle} onPress={() => setNoteOpen(p => !p)} accessibilityRole="button">
                  <Feather name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSub as string} />
                  <Text style={[s.noteToggleText, { color: theme.textSub }]}>{t('stepper.add_note')}</Text>
                </PressScale>

                {noteOpen && (
                  <TextInput
                    style={[s.noteInput, { backgroundColor: theme.noteInputBg, borderColor: theme.noteInputBorder, color: theme.text as string }]}
                    placeholder={t('stepper.note_placeholder')}
                    placeholderTextColor={theme.textPlaceholder as string}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    autoFocus
                    accessibilityLabel={t('stepper.add_note')}
                  />
                )}

                <View style={{ height: 100 }} />
              </AdaptiveScroll>
            )} />
          </>
        )}
      </View>

      <StepCTA
        testID="stepper-next-service"
        label={isQuoteFlow ? t('stepper.request_quote_cta') : t('stepper.continue')}
        onPress={onNext}
        disabled={!serviceChosen || missingShots.length > 0}
        hint={!serviceChosen
          ? t('stepper.select_service_type')
          : t('stepper.hint_photo_required', { label: t(`shots.${missingShots[0]?.key}.label`) })}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  step2Pad:    { paddingTop: 12, paddingBottom: 8 },
  skeletons:   { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
  unavailable: { fontFamily: FONTS.sans, fontSize: 13, paddingHorizontal: 24, paddingVertical: 12 },
  noteToggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, marginHorizontal: 24, paddingVertical: 4 },
  noteToggleText: { fontSize: 13, fontFamily: FONTS.sans },
  noteInput:      { borderRadius: 16, padding: 16, fontSize: 15, minHeight: 90, borderWidth: 1.5, fontFamily: FONTS.sans, marginHorizontal: 24 },
});
