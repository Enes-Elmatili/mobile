/**
 * AuthScreen — shared layout shell for all auth pages.
 *
 * Renders an inverted gradient (dark top → light bottom) so headlines sit on
 * dark and inputs/CTA sit on light. SafeAreaView wraps content with consistent
 * horizontal padding. KeyboardAvoidingView is opt-in for form pages.
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

type Variant = "inverted" | "standard";

type Props = {
  children: React.ReactNode;
  /** "inverted" (default) = dark top → light bottom. "standard" = welcome's light top → dark bottom. */
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
  const grad = variant === "inverted" ? invertedGradient : standardGradient;
  // Top of inverted gradient is dark → light status bar text.
  // Top of standard gradient is light → dark status bar text.
  const statusBarStyle = variant === "inverted" ? "light-content" : "dark-content";

  const Inner = (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={[s.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle={statusBarStyle} />
      <LinearGradient
        colors={grad.colors}
        locations={grad.locations}
        style={StyleSheet.absoluteFill}
      />
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
