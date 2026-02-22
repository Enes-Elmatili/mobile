// components/SquishButton.tsx
// Bouton "premium" réutilisable : spring scale + haptic feedback optionnel.
// Usage : remplace n'importe quel TouchableOpacity d'action principale.
//
//   <SquishButton onPress={() => router.push('/request/NewRequestStepper')} style={s.mainCTA}>
//     <Text style={s.mainCTATitle}>Que souhaitez-vous faire ?</Text>
//   </SquishButton>

import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics'; // npm install expo-haptics

interface SquishButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Intensité du retour haptique. 'none' pour désactiver. Default: 'light' */
  haptic?: 'none' | 'light' | 'medium' | 'heavy';
  /** Échelle cible au moment de l'appui. Default: 0.96 */
  scaleDown?: number;
  disabled?: boolean;
}

export function SquishButton({
  onPress,
  children,
  style,
  haptic = 'light',
  scaleDown = 0.96,
  disabled = false,
}: SquishButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const springIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleDown,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale, scaleDown]);

  const springOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic !== 'none') {
      const map = {
        light:  Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy:  Haptics.ImpactFeedbackStyle.Heavy,
      } as const;
      Haptics.impactAsync(map[haptic]).catch(() => {/* Silently fail on simulators */});
    }
    onPress();
  }, [disabled, haptic, onPress]);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
      <Pressable
        onPressIn={springIn}
        onPressOut={springOut}
        onPress={handlePress}
        disabled={disabled}
        style={{ flex: 1 }} // remplissage total du parent
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}