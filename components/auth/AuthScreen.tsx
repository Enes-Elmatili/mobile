/**
 * AuthScreen — shared layout shell for all auth pages.
 *
 * Renders an inverted gradient (dark top → light bottom) so headlines sit on
 * dark and inputs/CTA sit on light, or a "flat" theme-aware solid background
 * (theme.bg) for the v2 flat screens. SafeAreaView wraps content with
 * consistent horizontal padding. KeyboardAvoidingView is opt-in for form pages.
 */
import React from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ViewStyle,
  StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { authT, invertedGradient, standardGradient } from "./tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

type Variant = "inverted" | "standard" | "flat";

type Props = {
  children: React.ReactNode;
  /**
   * "inverted" (default) = dark top → light bottom. "standard" = welcome's
   * light top → dark bottom. "flat" = no gradient, theme-aware solid theme.bg
   * (statusBar follows the theme).
   */
  variant?: Variant;
  /** Wrap content in KeyboardAvoidingView + ScrollView for form pages. */
  scrollable?: boolean;
  /** Extra style for the inner content container. */
  contentStyle?: StyleProp<ViewStyle>;
};

export function AuthScreen({
  children,
  variant = "inverted",
  scrollable = false,
  contentStyle,
}: Props) {
  const theme = useAppTheme();
  const isFlat = variant === "flat";
  const grad = variant === "inverted" ? invertedGradient : standardGradient;
  // flat: fond uni theme-aware (onboarding dark par défaut, paper en light).
  // inverted: top sombre → texte clair. standard: top clair → texte sombre.
  const statusBarStyle = isFlat
    ? theme.statusBar
    : variant === "inverted" ? "light-content" : "dark-content";

  const Inner = (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={[s.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle={statusBarStyle} />
      {isFlat ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} />
      ) : (
        <LinearGradient
          colors={grad.colors}
          locations={grad.locations}
          style={StyleSheet.absoluteFill}
        />
      )}
      {scrollable ? (
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={s.flex}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
          >
            {Inner}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        Inner
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: authT.dark,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
  },
});
