/**
 * AuthCTA — primary white pill button with animated arrow.
 *
 * Sits in the LIGHT zone of the auth gradient (bottom). White pill with dark
 * Bebas text. Arrow oscillates left→right in a loop; replaced by a spinner
 * when loading.
 */
import React, { useEffect } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { FONTS, useAppTheme } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

type Variant = "inverted" | "standard" | "flat";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Hide the animated arrow (e.g. for "RETOUR" style buttons). */
  hideArrow?: boolean;
  /**
   * Match the AuthScreen variant.
   * "inverted" (default) = dark pill on the LIGHT zone of an inverted gradient.
   * "standard" = white pill on the DARK zone of welcome's standard gradient.
   * "flat" = theme-aware pill for flat (theme.bg) screens — resolves internally
   *   to "standard" in dark mode (light pill) and "inverted" in light mode
   *   (dark pill), i.e. the same ternary flat screens applied manually.
   */
  variant?: Variant;
};

export function AuthCTA({ label, onPress, loading, disabled, hideArrow, variant = "inverted" }: Props) {
  const theme = useAppTheme();
  const arrow = useSharedValue(0);
  const resolvedVariant: "inverted" | "standard" =
    variant === "flat" ? (theme.isDark ? "standard" : "inverted") : variant;
  const isStandard = resolvedVariant === "standard";
  const pillBg = isStandard ? authT.textOnDark : alpha(authT.dark, 0.95);
  const labelColor = isStandard ? authT.textOnLight : authT.textOnDark;
  const arrowColor = isStandard ? authT.textOnLight : authT.textOnDark;
  const borderColor = isStandard ? "transparent" : alpha(authT.textOnDark, 0.18);

  useEffect(() => {
    if (hideArrow || loading) { cancelAnimation(arrow); arrow.value = 0; return; }
    arrow.value = 0;
    // Un aller (1,4 s) puis retour instantané au départ : withRepeat sans reverse.
    arrow.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }), -1, false);
    return () => cancelAnimation(arrow);
  }, [arrow, hideArrow, loading]);

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(arrow.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(arrow.value, [0, 1], [-8, 8]) }],
  }));

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        s.cta,
        { backgroundColor: pillBg, borderColor, borderWidth: 1 },
        isDisabled && s.disabled,
        pressed && !isDisabled && { transform: [{ scale: 0.98 }], opacity: 0.95 },
      ]}
    >
      <Text style={[s.label, { color: labelColor }]} maxFontSizeMultiplier={1.3}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={arrowColor} style={s.arrow} />
      ) : !hideArrow ? (
        <Animated.View style={[s.arrow, arrowStyle]}>
          <Feather name="arrow-right" size={22} color={arrowColor} />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 100,
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 26,
    letterSpacing: 2,
  },
  arrow: {
    marginTop: 2,
  },
});
