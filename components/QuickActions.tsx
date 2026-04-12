// components/QuickActions.tsx
// Version "Smart-Routing" de ta QuickActions existante.
// Chaque icône de service transmet la catégorie à NewRequestStepper
// via les params de navigation → le formulaire se pré-remplit automatiquement.
//
// Remplace ton composant QuickActions actuel dans dashboard.tsx.

import React, { useRef, useCallback } from 'react';
import { View, Text, Animated, Pressable, FlatList, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

const QUICK_ACTIONS = [
  { icon: 'tool',          label: 'Bricol.',   category: 'bricolage'    },
  { icon: 'feather',       label: 'Jardin',    category: 'jardinage'    },
  { icon: 'home',          label: 'Ménage',    category: 'menage'       },
  { icon: 'truck',         label: 'Déménag.',  category: 'demenagement' },
  { icon: 'edit-2',        label: 'Peinture',  category: 'peinture'     },
  { icon: 'grid',          label: 'Tout voir', category: ''             },
] as const;

// ── Item animé — effet squish individuel par icône ──
function ActionItem({ item, isLast }: { item: typeof QUICK_ACTIONS[number]; isLast: boolean }) {
  const router = useRouter();
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const springIn  = () => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const springOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // ── Smart-Routing : on envoie la catégorie au stepper ──
    if (item.category) {
      router.push({
        pathname: '/request/NewRequestStepper',
        params: { selectedCategory: item.category },
      });
    } else {
      router.push('/request/NewRequestStepper');
    }
  }, [item.category, router]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={springIn}
        onPressOut={springOut}
        onPress={handlePress}
        style={qa.item}
      >
        <View style={[qa.circle, { backgroundColor: theme.surface, borderColor: theme.borderLight }, isLast && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
          <Feather name={item.icon as any} size={18} color={isLast ? theme.accentText : theme.text} />
        </View>
        <Text style={[qa.label, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function QuickActions() {
  const theme = useAppTheme();

  return (
    <View style={qa.wrap}>
      <Text style={[qa.title, { color: theme.text }]}>Services</Text>
      <FlatList
        data={QUICK_ACTIONS}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={qa.list}
        renderItem={({ item, index }) => (
          <ActionItem item={item} isLast={index === QUICK_ACTIONS.length - 1} />
        )}
      />
    </View>
  );
}

const qa = StyleSheet.create({
  wrap:  { marginBottom: 18 },
  title: { fontSize: 14, fontFamily: FONTS.sansMedium, marginBottom: 10, paddingHorizontal: 2 },
  list:  { gap: 6, paddingBottom: 2 },
  item:  { alignItems: 'center', gap: 6, width: 62 },
  circle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  label: { fontSize: 10, fontFamily: FONTS.sansMedium, textAlign: 'center', width: 62 },
});
