// components/auth/signup/SignupZonePhase.tsx — phase 3 (prestataire) : ville, rayon, métiers
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useTranslation } from "react-i18next";
import { feedback } from "@/lib/feedback/feedback";
import { FONTS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import { toFeatherName } from "@/lib/iconMapper";
import { PressScale } from '@/components/ui/PressScale';
import {
  CITY_OPTIONS,
  radiusLabelKey,
  requiredDocsCount,
  sortCategoriesByName,
  type SignupCategory,
} from "@/lib/auth/signupForm";
import { ss } from "./signupStyles";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

interface Props {
  city: string;
  setCity: (v: string) => void;
  radius: number;
  setRadius: (v: number) => void;
  categories: SignupCategory[];
  catsLoading: boolean;
  catsError: boolean;
  selectedCats: number[];
  onToggleCat: (id: number) => void;
  onRetryCats: () => void;
}

export function SignupZonePhase(p: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { city, radius, categories, selectedCats } = p;
  return (
    <View style={ss.body}>
      <View>
        <Text style={[s.sectionLabel, { color: alpha(theme.text, 0.55) }]} maxFontSizeMultiplier={1.2}>
          {t('auth.su_zone_city')}
        </Text>
        <View style={s.cityDropdown}>
          {CITY_OPTIONS.map((opt) => (
            <PressScale accessibilityRole="button"
              key={opt.value}
              style={[
                s.cityOption,
                { backgroundColor: theme.cardBg, borderColor: theme.borderLight },
                city === opt.value && { backgroundColor: theme.text, borderColor: theme.text },
              ]}
              onPress={() => {
                feedback.haptic('selection');
                p.setCity(opt.value);
              }}
            >
              <Feather
                name="map-pin"
                size={15}
                color={city === opt.value ? theme.bg : alpha(theme.text, 0.6)}
              />
              <Text
                style={[
                  s.cityOptionText,
                  { color: city === opt.value ? theme.bg : alpha(theme.text, 0.85) },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                {opt.label}
              </Text>
              {city === opt.value && <Feather name="check-circle" size={18} color={theme.brandDot} />}
            </PressScale>
          ))}
        </View>
      </View>

      <View>
        <Text style={[s.sectionLabel, { color: alpha(theme.text, 0.55) }]} maxFontSizeMultiplier={1.2}>
          {t('auth.su_zone_radius')}
        </Text>
        <View style={[s.sliderWrap, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={s.sliderValueRow}>
            <Text style={[s.sliderValue, { color: theme.text }]} maxFontSizeMultiplier={1.2}>
              {radius} km
            </Text>
            <Text
              style={[s.sliderAnnotation, { color: alpha(theme.text, theme.isDark ? 0.3 : 0.45) }]}
              maxFontSizeMultiplier={1.2}
            >
              {t(radiusLabelKey(radius))}
            </Text>
          </View>
          <Slider
            minimumValue={1}
            maximumValue={15}
            step={1}
            value={radius}
            onValueChange={(v: number) => p.setRadius(v)}
            minimumTrackTintColor={theme.text}
            maximumTrackTintColor={alpha(theme.text, 0.15)}
            thumbTintColor={theme.text}
            style={{ width: "100%", height: 40 }}
          />
          <View style={s.sliderLabels}>
            <Text
              style={[s.sliderLabelText, { color: alpha(theme.text, theme.isDark ? 0.3 : 0.45) }]}
              maxFontSizeMultiplier={1.2}
            >
              1 km
            </Text>
            <Text
              style={[s.sliderLabelText, { color: alpha(theme.text, theme.isDark ? 0.3 : 0.45) }]}
              maxFontSizeMultiplier={1.2}
            >
              15 km
            </Text>
          </View>
        </View>
      </View>

      <View>
        <Text style={[s.sectionLabel, { color: alpha(theme.text, 0.55) }]} maxFontSizeMultiplier={1.2}>
          {t('auth.su_zone_cats')}
        </Text>
        {p.catsLoading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={alpha(theme.text, 0.6)} />
          </View>
        ) : p.catsError && categories.length === 0 ? (
          <PressScale accessibilityRole="button" style={s.centered} onPress={p.onRetryCats}>
            <Feather name="refresh-cw" size={24} color={alpha(theme.text, theme.isDark ? 0.5 : 0.68)} />
            <Text
              style={[s.retryText, { color: alpha(theme.text, theme.isDark ? 0.5 : 0.68) }]}
              maxFontSizeMultiplier={1.2}
            >
              {t('common.retry')}
            </Text>
          </PressScale>
        ) : (
          <View style={s.catGrid}>
            {sortCategoriesByName(categories).map((cat) => {
              const sel = selectedCats.includes(cat.id);
              return (
                <PressScale accessibilityRole="button"
                  key={cat.id}
                  style={[
                    s.chip,
                    { backgroundColor: theme.cardBg, borderColor: theme.borderLight },
                    sel && { backgroundColor: theme.text, borderColor: theme.text },
                  ]}
                  onPress={() => p.onToggleCat(cat.id)}
                >
                  <Feather
                    name={toFeatherName(cat.icon, "briefcase") as FeatherName}
                    size={15}
                    color={sel ? theme.bg : alpha(theme.text, 0.55)}
                  />
                  <Text
                    numberOfLines={1}
                    style={[s.chipText, { color: sel ? theme.bg : alpha(theme.text, 0.9) }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {cat.name}
                  </Text>
                </PressScale>
              );
            })}
          </View>
        )}
        {selectedCats.length > 0 && (
          <Text
            style={[s.catCount, { color: alpha(theme.text, theme.isDark ? 0.5 : 0.68) }]}
            maxFontSizeMultiplier={1.2}
          >
            {t('auth.su_cat_count', {
              count: selectedCats.length,
              docs: requiredDocsCount(categories, selectedCats),
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Zone — section labels
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 10,
  },

  // City
  cityDropdown: {
    gap: 8,
  },
  cityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  cityOptionText: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },

  // Slider
  sliderWrap: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  sliderValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  sliderValue: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 28,
    letterSpacing: 1.5,
  },
  sliderAnnotation: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderLabelText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
  },

  // Categories
  centered: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 100,
    minWidth: "47%",
    flexGrow: 1,
  },
  chipText: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  catCount: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 10,
  },
});
