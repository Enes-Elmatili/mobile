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
 *
 * Emits via onChangeFormattedText:
 *   "+32470123456"   (E.164, dial code prefixed)
 * The local number prop is uncontrolled — parent reads only the formatted output.
 */
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import CountryPicker from "react-native-country-picker-modal";
import type { Country, CountryCode } from "react-native-country-picker-modal";
import { Feather } from "@expo/vector-icons";
import { FONTS } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

type Props = {
  defaultValue?: string;
  onChangeText?: (localNumber: string) => void;
  onChangeFormattedText?: (e164: string) => void;
  error?: string | null;
  label?: string;
  placeholder?: string;
  returnKeyType?: "done" | "next" | "go" | "search" | "send";
  onSubmitEditing?: () => void;
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
  label = "Téléphone *",
  placeholder = "470 12 34 56",
  returnKeyType = "next",
  onSubmitEditing,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [country, setCountry] = useState<{ cca2: CountryCode; callingCode: string }>(
    DEFAULT_COUNTRY
  );
  const [number, setNumber] = useState(defaultValue);

  // Emit changes upward whenever the country or local number shifts.
  useEffect(() => {
    const digits = number.replace(/\D/g, "");
    onChangeText?.(digits);
    onChangeFormattedText?.(digits ? `+${country.callingCode}${digits}` : "");
  }, [country, number]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSelect = (c: Country) => {
    setCountry({
      cca2: c.cca2,
      callingCode: Array.isArray(c.callingCode) ? c.callingCode[0] : (c.callingCode as string),
    });
    setPickerVisible(false);
  };

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View
        style={[
          s.field,
          focused && s.fieldFocused,
          !!error && s.fieldError,
        ]}
      >
        {/* Country chip — flag + dial code + chevron */}
        <TouchableOpacity
          style={s.chip}
          activeOpacity={0.7}
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
            filterProps={{ placeholder: "Rechercher un pays...", autoFocus: true }}
          />
          <Text style={s.dialCode}>+{country.callingCode}</Text>
          <Feather name="chevron-down" size={14} color={alpha(authT.textOnDark, 0.5)} />
        </TouchableOpacity>

        {/* Subtle separator between chip and number */}
        <View style={s.divider} />

        {/* Local number input */}
        <TextInput
          style={s.numberInput}
          value={number}
          onChangeText={setNumber}
          placeholder={placeholder}
          placeholderTextColor={alpha(authT.textOnDark, 0.4)}
          keyboardType="phone-pad"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={authT.textOnDark}
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
