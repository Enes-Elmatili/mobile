// components/QuickActions.tsx
// Version "Smart-Routing" de ta QuickActions existante.
// Chaque icône de service transmet la catégorie à NewRequestStepper
// via les params de navigation → le formulaire se pré-remplit automatiquement.
//
// Remplace ton composant QuickActions actuel dans dashboard.tsx.

import React, { useRef, useCallback } from 'react';
import { View, Text, Animated, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const QUICK_ACTIONS = [
  { icon: 'hammer-outline',   label: 'Bricol.',   category: 'bricolage'    },
  { icon: 'leaf-outline',     label: 'Jardin',    category: 'jardinage'    },
  { icon: 'sparkles-outline', label: 'Ménage',    category: 'menage'       },
  { icon: 'car-outline',      label: 'Déménag.',  category: 'demenagement' },
  { icon: 'brush-outline',    label: 'Peinture',  category: 'peinture'     },
  { icon: 'grid-outline',     label: 'Tout voir', category: ''             },
] as const;

// ── Item animé — effet squish individuel par icône ──
function ActionItem({ item, isLast }: { item: typeof QUICK_ACTIONS[number]; isLast: boolean }) {
  const router = useRouter();
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
        <View style={[qa.circle, isLast && qa.circleLast]}>
          <Ionicons name={item.icon as any} size={18} color={isLast ? '#FFF' : '#111'} />
        </View>
        <Text style={qa.label} numberOfLines={1}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function QuickActions() {
  return (
    <View style={qa.wrap}>
      <Text style={qa.title}>Services</Text>
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
  title: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 10, paddingHorizontal: 2 },
  list:  { gap: 6, paddingBottom: 2 },
  item:  { alignItems: 'center', gap: 6, width: 62 },
  circle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  circleLast: { backgroundColor: '#111', borderColor: '#111' },
  label: { fontSize: 10, fontWeight: '600', color: '#888', textAlign: 'center', width: 62 },
});