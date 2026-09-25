/**
 * AuthPhoneInput — country-code phone picker for the FIXED auth flow.
 *
 * Built directly on react-native-country-picker-modal (the picker / flag layer)
 * + a plain TextInput (the number layer). We control the chip, the picker, and
 * the formatting ourselves, which avoids the incompatibility between
 * react-native-phone-number-input@2.1 and the current country-picker-modal
 * (the older lib doesn't pass `withFlagButton` so flags rendered as null).
 *
 * Visually identical to <AuthInput>: same height, border, focus/error palette.
 * Pass `themed` to opt into theme-aware colors for flat v2 screens (default
 * false = gradient zone rendering, strictly unchanged).
 *
 * Emits via onChangeFormattedText:
 *   "+32470123456"   (E.164, dial code prefixed)
 * The local number prop is uncontrolled — parent reads only the formatted output.
 *
 * Normalisation (lib/phone.ts) : le 0 national tapé en tête disparaît à la
 * frappe (« 0470… » → « 470… »), un indicatif tapé ou collé dans le champ
 * (« +32 470… », « 0032… », autofill iOS) est replié dans le chip au blur.
 * Avant ça, « +32 » + « 0470… » donnait +320470123456 — un faux numéro.
 */
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import CountryPicker, { getAllCountries, FlagType } from "react-native-country-picker-modal";
import type { Country, CountryCode } from "react-native-country-picker-modal";
import { toE164, splitInternational, keepsLeadingZero } from "@/lib/phone";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, useAppTheme } from "@/hooks/use-app-theme";
import { authT, alpha, themedFieldColors } from "./tokens";
import { PressScale } from '@/components/ui/PressScale';

type Props = {
  defaultValue?: string;
  onChangeText?: (localNumber: string) => void;
  onChangeFormattedText?: (e164: string) => void;
  error?: string | null;
  label?: string;
  placeholder?: string;
  returnKeyType?: "done" | "next" | "go" | "search" | "send";
  onSubmitEditing?: () => void;
  /**
   * Use theme-aware colors (derived from useAppTheme) instead of the fixed
   * gradient zone tones — for flat (theme.bg) screens. Defaults to false —
   * strictly unchanged behavior for the existing gradient screens.
   */
  themed?: boolean;
};

const DEFAULT_COUNTRY: { cca2: CountryCode; callingCode: string } = {
  cca2: "BE",
  callingCode: "32",
};

export function AuthPhoneInput({
  defaultValue = "",
  onChangeText,
  onChangeFormattedText,
  error,
  label,
  placeholder = "470 12 34 56",
  returnKeyType = "next",
  onSubmitEditing,
  themed = false,
}: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const resolvedLabel = label === undefined ? t("auth.phone_label") : label;
  const [focused, setFocused] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [country, setCountry] = useState<{ cca2: CountryCode; callingCode: string }>(
    DEFAULT_COUNTRY
  );
  const [number, setNumber] = useState(defaultValue);

  // Emit changes upward whenever the country or local number shifts. Ce qui
  // remonte est toujours normalisé, quel que soit l'état d'affichage du champ.
  useEffect(() => {
    const { local } = splitInternational(country.callingCode, number);
    onChangeText?.(local);
    onChangeFormattedText?.(toE164(country.callingCode, number));
  }, [country, number]); // eslint-disable-line react-hooks/exhaustive-deps

  // À la frappe : seul le 0 national de tête est retiré (sans ambiguïté, et
  // immédiat pour que l'utilisateur voie qu'il n'est pas attendu). Le reste
  // (indicatif tapé/collé) attend le blur — on ne se bat pas avec le clavier.
  const onTypeNumber = (text: string) => {
    if (!keepsLeadingZero(country.callingCode) && /^\s*0/.test(text) && !text.trim().startsWith("+")) {
      setNumber(text.replace(/^\s*0+/, ""));
      return;
    }
    setNumber(text);
  };

  // Au blur : « +33 6… » / « 0032 470… » → le chip prend l'indicatif, le champ
  // ne garde que la partie locale.
  const onBlurNumber = async () => {
    setFocused(false);
    const { callingCode, local } = splitInternational(country.callingCode, number);
    if (callingCode !== country.callingCode) {
      try {
        const all = await getAllCountries(FlagType.EMOJI);
        const match = all.find((c) => c.callingCode?.includes(callingCode));
        if (match) setCountry({ cca2: match.cca2, callingCode });
      } catch {
        // Pas de drapeau trouvé : l'indicatif tapé reste dans le champ, la
        // valeur émise (toE164) est correcte quand même.
        return;
      }
    }
    if (local !== number) setNumber(local);
  };

  const onSelect = (c: Country) => {
    setCountry({
      cca2: c.cca2,
      callingCode: Array.isArray(c.callingCode) ? c.callingCode[0] : (c.callingCode as string),
    });
    setPickerVisible(false);
  };

  const f = themedFieldColors(theme, focused);

  return (
    <View style={s.wrap}>
      {resolvedLabel ? (
        <Text style={[s.label, themed && { color: f.label }]}>{resolvedLabel}</Text>
      ) : null}
      <View
        style={[
          s.field,
          themed && f.field,
          focused && (themed ? { borderColor: f.focusBorder } : s.fieldFocused),
          !!error && s.fieldError,
        ]}
      >
        {/* Country chip — flag + dial code + chevron */}
        <PressScale accessibilityRole="button"
          style={s.chip}
          onPress={() => setPickerVisible(true)}
        >
          <CountryPicker
            countryCode={country.cca2}
            withFlag
            withFilter
            withCallingCode
            withEmoji
            withFlagButton
            withCountryNameButton={false}
            onSelect={onSelect}
            onClose={() => setPickerVisible(false)}
            visible={pickerVisible}
            // Keep the picker's filter input hint localized.
            filterProps={{ placeholder: t("auth.country_search_placeholder"), autoFocus: true }}
          />
          <Text style={[s.dialCode, themed && { color: theme.text }]}>+{country.callingCode}</Text>
          <Feather
            name="chevron-down"
            size={14}
            color={themed ? alpha(theme.text, 0.5) : alpha(authT.textOnDark, 0.5)}
          />
        </PressScale>

        {/* Subtle separator between chip and number */}
        <View style={[s.divider, themed && { backgroundColor: alpha(theme.text, 0.12) }]} />

        {/* Local number input */}
        <TextInput
          style={[s.numberInput, themed && { color: theme.text }]}
          value={number}
          onChangeText={onTypeNumber}
          placeholder={placeholder}
          placeholderTextColor={themed ? f.placeholder : alpha(authT.textOnDark, 0.4)}
          keyboardType="phone-pad"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={onBlurNumber}
          selectionColor={themed ? f.selection : authT.textOnDark}
          autoCorrect={false}
          textContentType="telephoneNumber"
        />
      </View>

      {error ? (
        <View style={s.errorRow}>
          <Feather name="alert-circle" size={12} color="#DC2626" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: alpha(authT.textOnLight, 0.55),
    marginBottom: 6,
    textTransform: "uppercase",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: alpha(authT.dark, 0.7),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.14),
    borderRadius: 14,
    height: 46,
    overflow: "hidden",
  },
  fieldFocused: {
    backgroundColor: alpha(authT.dark, 0.92),
    borderColor: alpha(authT.textOnDark, 0.4),
  },
  fieldError: {
    borderColor: "#DC2626",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 8,
    height: "100%",
    gap: 6,
  },
  dialCode: {
    fontFamily: FONTS.sansMedium,
    fontSize: 15,
    color: authT.textOnDark,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: alpha(authT.textOnDark, 0.12),
    marginRight: 12,
  },
  numberInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: authT.textOnDark,
    paddingVertical: 0,
    paddingRight: 14,
    height: "100%",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: "#DC2626",
  },
});
