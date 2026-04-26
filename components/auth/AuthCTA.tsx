/**
 * AuthCTA — primary white pill button with animated arrow.
 *
 * Sits in the LIGHT zone of the auth gradient (bottom). White pill with dark
 * Bebas text. Arrow oscillates left→right in a loop; replaced by a spinner
 * when loading.
 */
import React, { useEffect, useRef } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FONTS } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

type Variant = "inverted" | "standard";

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
   */
  variant?: Variant;
};

export function AuthCTA({ label, onPress, loading, disabled, hideArrow, variant = "inverted" }: Props) {
  const arrowAnim = useRef(new Animated.Value(0)).current;
  const isStandard = variant === "standard";
  const pillBg = isStandard ? authT.textOnDark : alpha(authT.dark, 0.95);
  const labelColor = isStandard ? authT.textOnLight : authT.textOnDark;
  const arrowColor = isStandard ? authT.textOnLight : authT.textOnDark;
  const borderColor = isStandard ? "transparent" : alpha(authT.textOnDark, 0.18);

  useEffect(() => {
    if (hideArrow || loading) return;
    arrowAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [arrowAnim, hideArrow, loading]);

  const arrowTranslateX = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });
  const arrowOpacity = arrowAnim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.cta,
        { backgroundColor: pillBg, borderColor, borderWidth: 1 },
        isDisabled && s.disabled,
        pressed && !isDisabled && { transform: [{ scale: 0.98 }], opacity: 0.95 },
      ]}
    >
      <Text style={[s.label, { color: labelColor }]}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={arrowColor} style={s.arrow} />
      ) : !hideArrow ? (
        <Animated.View
          style={[
            s.arrow,
            { opacity: arrowOpacity, transform: [{ translateX: arrowTranslateX }] },
          ]}
        >
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
    fontFamily: FONTS.bebas,
    fontSize: 26,
    letterSpacing: 2,
  },
  arrow: {
    marginTop: 2,
  },
});
