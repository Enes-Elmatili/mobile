/**
 * AuthPhoneInput — country-code phone picker for the FIXED auth flow.
 *
 * Wraps react-native-phone-number-input and matches AuthInput exactly:
 * same height (46), same border, same focus colour, same error row.
 *
 * Default country: BE (Belgium). User can tap the flag chip to open
 * the country picker modal.
 *
 * Emits:
 *   onChangeText(rawNumber)          — digits only, without dial code
 *   onChangeFormattedText(e164)      — full E.164, e.g. "+32470123456"
 */
import React, { useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import PhoneInput from "react-native-phone-number-input";
import type { PhoneInputProps } from "react-native-phone-number-input";
import { Feather } from "@expo/vector-icons";
import { FONTS } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  onChangeFormattedText?: (text: string) => void;
  error?: string | null;
  label?: string;
  placeholder?: string;
  returnKeyType?: "done" | "next" | "go" | "search" | "send";
  onSubmitEditing?: () => void;
};

export function AuthPhoneInput({
  value = "",
  onChangeText,
  onChangeFormattedText,
  error,
  label = "Téléphone *",
  placeholder = "470 12 34 56",
  returnKeyType = "next",
  onSubmitEditing,
}: Props) {
  const [focused, setFocused] = useState(false);
  const phoneRef = useRef<PhoneInput>(null);

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
        <PhoneInput
          ref={phoneRef}
          defaultCode="BE"
          layout="first"
          value={value}
          onChangeText={onChangeText}
          onChangeFormattedText={onChangeFormattedText}
          withDarkTheme={false}
          placeholder={placeholder}
          containerStyle={s.phoneContainer}
          textContainerStyle={s.textContainer}
          textInputStyle={s.textInput}
          codeTextStyle={s.codeText}
          flagButtonStyle={s.flagButton}
          countryPickerProps={{
            withFilter: true,
            withFlag: true,
            withCallingCode: true,
            // Emoji flags are rendered by the OS (universal on iOS, decent on
            // Android 11+). Convention in payment / billing UIs (Stripe, Revolut,
            // Splitwise) is to keep them — they're the strongest visual cue.
            withEmoji: true,
            withCountryNameButton: false,
            filterProps: {
              placeholder: "Rechercher un pays...",
              autoFocus: true,
            },
          }}
          textInputProps={{
            keyboardType: "phone-pad",
            returnKeyType,
            onSubmitEditing,
            placeholderTextColor: alpha(authT.textOnDark, 0.4),
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
            selectionColor: authT.textOnDark,
          }}
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
  // PhoneInput internal overrides
  phoneContainer: {
    flex: 1,
    height: 44,
    backgroundColor: "transparent",
  },
  textContainer: {
    flex: 1,
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  textInput: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: authT.textOnDark,
    height: 44,
    paddingVertical: 0,
    margin: 0,
  },
  codeText: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: authT.textOnDark,
  },
  flagButton: {
    paddingLeft: 14,
    paddingRight: 4,
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
