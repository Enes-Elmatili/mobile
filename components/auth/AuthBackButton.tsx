/**
 * AuthBackButton — 36×36 rounded back button.
 *
 * Sits in the DARK zone (top of inverted gradient) — uses textOnDark for
 * border/icon contrast.
 */
import React from "react";
import { Pressable, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Feather } from "@expo/vector-icons";
import { authT, alpha } from "./tokens";

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function AuthBackButton({ onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        s.btn,
        pressed && { transform: [{ scale: 0.94 }], opacity: 0.85 },
        style,
      ]}
    >
      <Feather name="chevron-left" size={20} color={authT.textOnDark} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.18),
    backgroundColor: alpha(authT.textOnDark, 0.05),
    justifyContent: "center",
    alignItems: "center",
  },
});
