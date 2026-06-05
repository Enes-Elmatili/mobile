/**
 * RaisedButton — bouton "tactile" avec profondeur visuelle.
 *
 * Compose 3 couches pour donner une vraie sensation pressable :
 *  1. Top highlight (1.5px) → simule la lumière qui frappe le bord supérieur
 *  2. Bottom chamfer (1px sombre) → simule l'épaisseur du bouton
 *  3. Drop shadow → décolle du fond
 *
 * Au press : scale 0.97 + dim du highlight + collapse léger de la shadow,
 * couplé à un retour haptique. Identique iOS/Android.
 *
 * Usage minimal :
 *   <RaisedButton label="CONFIRMER" onPress={...} />
 *
 * Variants principales :
 *   variant="primary"     → pill clair, texte sombre (default)
 *   variant="secondary"   → pill sombre, texte clair
 *   variant="destructive" → rouge danger
 *   variant="success"     → vert brand
 *
 * Iconographie : Feather only (charte FIXED).
 */
import React, { useRef, useCallback } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { feedback } from '@/lib/feedback/feedback';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

type Variant = 'primary' | 'secondary' | 'destructive' | 'success';
type Size = 'lg' | 'md' | 'sm';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface RaisedButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: FeatherName;
  iconRight?: FeatherName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Désactive le retour haptique (default = light, medium si destructive). */
  haptic?: 'none' | 'light' | 'medium' | 'heavy';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Forcer une police display (Bebas Neue) pour les CTAs principaux. */
  display?: boolean;
}

export function RaisedButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = true,
  haptic,
  style,
  labelStyle,
  display = false,
}: RaisedButtonProps) {
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const pressDim = useRef(new Animated.Value(0)).current;

  const isInactive = disabled || loading;

  // ── Variant → couleurs ────────────────────────────────────────────────────
  // Idée centrale : on construit chaque variante autour d'un "base" (le fond du
  // bouton), d'un "highlight" (rgba blanc/noir pour le liseré supérieur) et
  // d'un "chamfer" (liseré inférieur pour donner l'épaisseur).
  const v = resolveVariant(variant, theme);

  // ── Size → métriques ──────────────────────────────────────────────────────
  const m = SIZE_METRICS[size];

  // ── Haptic par défaut selon variante ──────────────────────────────────────
  const defaultHaptic =
    haptic ?? (variant === 'destructive' ? 'medium' : 'light');

  const onPressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(pressDim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, pressDim]);

  const onPressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 8,
      }),
      Animated.timing(pressDim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, pressDim]);

  const handlePress = useCallback(() => {
    if (isInactive) return;
    if (defaultHaptic !== 'none') feedback.haptic(defaultHaptic);
    onPress();
  }, [isInactive, defaultHaptic, onPress]);

  return (
    <Animated.View
      style={[
        styles.outer,
        fullWidth && styles.fullWidth,
        {
          borderRadius: m.radius,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: theme.isDark ? 0.45 : 0.15,
          shadowRadius: 10,
          elevation: theme.isDark ? 8 : 5,
          transform: [{ scale }],
          opacity: isInactive ? 0.55 : 1,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isInactive, busy: loading }}
        onPressIn={isInactive ? undefined : onPressIn}
        onPressOut={isInactive ? undefined : onPressOut}
        onPress={handlePress}
        disabled={isInactive}
        style={{ borderRadius: m.radius, overflow: 'hidden' }}
      >
        <View
          style={{
            backgroundColor: v.base,
            paddingHorizontal: m.padX,
            height: m.height,
            borderRadius: m.radius,
            borderTopWidth: 1.5,
            borderTopColor: v.highlight,
            borderBottomWidth: 1,
            borderBottomColor: v.chamfer,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {/* Press dim overlay — assombrit légèrement la surface au press */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: '#000',
                opacity: pressDim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, theme.isDark ? 0.18 : 0.08],
                }),
              },
            ]}
          />

          {loading ? (
            <ActivityIndicator color={v.fg} />
          ) : (
            <>
              {icon ? <Feather name={icon} size={m.icon} color={v.fg} /> : null}
              <Text
                numberOfLines={1}
                style={[
                  {
                    color: v.fg,
                    fontFamily: display ? FONTS.bebas : FONTS.sansMedium,
                    fontSize: display ? m.displayFs : m.fs,
                    letterSpacing: display ? 1.2 : 0.3,
                    textTransform: display ? 'uppercase' : 'none',
                  },
                  labelStyle,
                ]}
              >
                {label}
              </Text>
              {iconRight ? (
                <Feather name={iconRight} size={m.icon} color={v.fg} />
              ) : null}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Variant resolver ────────────────────────────────────────────────────────
// Sépare la logique de couleurs pour garder le composant lisible. Pour chaque
// variante on définit base (fond), fg (texte/icone), highlight (top edge) et
// chamfer (bottom edge interne).
function resolveVariant(variant: Variant, theme: ReturnType<typeof useAppTheme>) {
  switch (variant) {
    case 'secondary':
      return {
        base: theme.isDark ? '#1A1A1A' : '#1A1A18',
        fg: '#F4F4F2',
        highlight: 'rgba(255,255,255,0.16)',
        chamfer: 'rgba(0,0,0,0.5)',
      };
    case 'destructive':
      return {
        base: COLORS.danger,
        fg: '#FFFFFF',
        highlight: 'rgba(255,255,255,0.28)',
        chamfer: 'rgba(0,0,0,0.35)',
      };
    case 'success':
      return {
        base: COLORS.greenBrand,
        fg: '#FFFFFF',
        highlight: 'rgba(255,255,255,0.26)',
        chamfer: 'rgba(0,0,0,0.3)',
      };
    case 'primary':
    default:
      // Primary = pill clair sur fond sombre / pill sombre sur fond clair.
      // Le contraste cohérent avec accent/accentText du theme.
      return {
        base: theme.accent,
        fg: theme.accentText,
        highlight: theme.isDark
          ? 'rgba(255,255,255,0.55)' // bord brillant sur la pill blanche
          : 'rgba(255,255,255,0.18)', // light bord interne sur la pill foncée
        chamfer: theme.isDark
          ? 'rgba(0,0,0,0.18)'
          : 'rgba(0,0,0,0.4)',
      };
  }
}

const SIZE_METRICS = {
  lg: { height: 56, padX: 22, radius: 18, fs: 16, displayFs: 22, icon: 20 },
  md: { height: 44, padX: 18, radius: 14, fs: 14, displayFs: 18, icon: 18 },
  sm: { height: 36, padX: 14, radius: 12, fs: 13, displayFs: 15, icon: 16 },
} as const;

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});

export default RaisedButton;
