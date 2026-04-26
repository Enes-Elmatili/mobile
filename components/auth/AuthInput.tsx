/**
 * AuthInput — text input adapted to the LIGHT zone of the auth gradient.
 *
 * Dark text on a near-white surface, with a subtle border. Optional left icon
 * (Feather), trailing toggle (e.g. password eye), focus state, error state.
 *
 * Uses the React 19 ref-as-prop pattern — pass `inputRef` to access the
 * underlying TextInput (e.g. for focus chains).
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FONTS } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

type Props = TextInputProps & {
  icon?: keyof typeof Feather.glyphMap;
  /** Trailing icon (e.g. eye for password). */
  trailingIcon?: keyof typeof Feather.glyphMap;
  onTrailingPress?: () => void;
  error?: string | null;
  label?: string;
  /** Ref to the underlying TextInput for imperative focus. */
  inputRef?: React.Ref<TextInput>;
};

export function AuthInput({
  icon,
  trailingIcon,
  onTrailingPress,
  error,
  label,
  onFocus,
  onBlur,
  style,
  inputRef,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={s.wrap}>
      {label && <Text style={s.label}>{label}</Text>}
      <View
        style={[
          s.field,
          focused && s.fieldFocused,
          !!error && s.fieldError,
        ]}
      >
        {icon && (
          <Feather
            name={icon}
            size={16}
            color={alpha(authT.textOnDark, focused ? 0.85 : 0.55)}
            style={s.icon}
          />
        )}
        <TextInput
          ref={inputRef}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={alpha(authT.textOnDark, 0.4)}
          style={[s.input, style]}
        />
        {trailingIcon && (
          <Pressable hitSlop={8} onPress={onTrailingPress} style={s.trailing}>
            <Feather
              name={trailingIcon}
              size={16}
              color={alpha(authT.textOnDark, 0.6)}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <View style={s.errorRow}>
          <Feather name="alert-circle" size={12} color="#DC2626" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}
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
  // Dark field that stays readable across the entire gradient (mid-zone or light-zone)
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: alpha(authT.dark, 0.7),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.14),
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
  },
  fieldFocused: {
    backgroundColor: alpha(authT.dark, 0.92),
    borderColor: alpha(authT.textOnDark, 0.4),
  },
  fieldError: {
    borderColor: "#DC2626",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: authT.textOnDark,
    paddingVertical: 0,
  },
  trailing: {
    paddingLeft: 10,
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
