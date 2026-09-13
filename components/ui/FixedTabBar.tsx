// components/ui/FixedTabBar.tsx
// Tab bar custom d'Expo Router. Deux dispositions, un seul composant :
//   compact  → barre en bas (verre dépoli), indicateur qui GLISSE sous
//              l'onglet actif (moment 15) ; l'icône se redresse (TabIcon)
//   regular  → sidebar à gauche (Apple : la tab bar devient une sidebar sur
//              les largeurs regular), même indicateur, vertical
// L'indicateur repart de sa position courante (règle 1) sur MOTION.tab.
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAppTheme, FONTS, alpha } from '@/hooks/use-app-theme';
import { useLayoutClass } from '@/lib/layout/useLayoutClass';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { TabIcon } from './TabIcon';

type FeatherName = React.ComponentProps<typeof TabIcon>['name'];

/** Hauteur du contenu de la barre (hors inset bas). */
export const TAB_BAR_HEIGHT = 56;
/** Largeur de la sidebar sur regular. */
export const SIDEBAR_WIDTH = 88;
const TAB_PB = Platform.OS === 'ios' ? 20 : 8;

/** Icônes par nom de route — la source unique, lue aussi par app/(tabs)/_layout.tsx. */
export const TAB_ICONS: Record<string, FeatherName> = {
  dashboard: 'home',
  missions: 'zap',
  documents: 'file-text',
  wallet: 'credit-card',
  profile: 'user',
};

function Background({ vertical }: { vertical: boolean }) {
  const theme = useAppTheme();
  if (Platform.OS === 'android') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(theme.bg, 0.98) }]} />;
  }
  return <BlurView intensity={55} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents={vertical ? 'none' : undefined} />;
}

function TabItem({ label, icon, focused, color, onPress, onLongPress, vertical, accessibilityLabel }: {
  label: string; icon: FeatherName; focused: boolean; color: string; onPress: () => void; onLongPress: () => void; vertical: boolean; accessibilityLabel?: string;
}) {
  const press = usePressScale();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onLongPress={onLongPress}
      {...press.handlers}
      style={[s.item, vertical && s.itemVertical]}
    >
      <Animated.View style={[s.itemInner, press.style]}>
        <TabIcon name={icon} color={color} focused={focused} />
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[s.label, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function FixedTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useAppTheme();
  const { isRegular } = useLayoutClass();
  const reduced = useReduceMotion();

  // Onglets visibles. Expo Router ne transmet PAS `href` aux descripteurs :
  // il le retire des options et marque la route cachée (`href: null`) avec
  // `tabBarItemStyle: { display: 'none' }` et un `tabBarButton` qui rend null.
  // Filtrer sur `href` laissait donc passer les onglets de l'autre rôle
  // (Missions et Gains chez le client, Documents chez le prestataire).
  const routes = state.routes.filter((r) => {
    const style = StyleSheet.flatten(descriptors[r.key].options.tabBarItemStyle);
    return style?.display !== 'none';
  });
  const activeIndex = Math.max(0, routes.findIndex((r) => r.key === state.routes[state.index]?.key));

  const indicator = useSharedValue(activeIndex);
  useEffect(() => {
    indicator.value = reduced ? withTiming(activeIndex, { duration: 120 }) : withSpring(activeIndex, MOTION.tab);
  }, [activeIndex, reduced, indicator]);

  const count = Math.max(1, routes.length);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const indicatorStyle = useAnimatedStyle(() => {
    const slot = isRegular ? size.h / count : size.w / count;
    return isRegular
      ? { transform: [{ translateY: indicator.value * slot }], height: slot }
      : { transform: [{ translateX: indicator.value * slot }], width: slot };
  });

  const bottomPad = Math.max(insets.bottom, TAB_PB);

  return (
    <View
      style={
        isRegular
          ? [s.sidebar, { width: SIDEBAR_WIDTH, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingLeft: insets.left, borderRightColor: theme.border }]
          : [s.bar, { height: TAB_BAR_HEIGHT + bottomPad, paddingBottom: bottomPad, borderTopColor: theme.border }]
      }
    >
      <Background vertical={isRegular} />
      <View
        style={[s.track, isRegular && s.trackVertical]}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <Animated.View pointerEvents="none" style={[s.indicator, isRegular ? s.indicatorVertical : s.indicatorHorizontal, indicatorStyle]}>
          <View style={[s.indicatorPill, isRegular && s.indicatorPillVertical, { backgroundColor: theme.accent }]} />
        </Animated.View>
        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === state.routes[state.index]?.key;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? (theme.accent as string) : (theme.textMuted as string);
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              feedback.haptic('selection');
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
          return (
            <TabItem
              key={route.key}
              label={label}
              icon={TAB_ICONS[route.name] ?? 'circle'}
              focused={focused}
              color={color}
              onPress={onPress}
              onLongPress={onLongPress}
              vertical={isRegular}
              accessibilityLabel={options.tabBarAccessibilityLabel}
            />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 8, overflow: 'hidden' },
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRightWidth: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  trackVertical: { flexDirection: 'column' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemVertical: { flex: 0, height: 72 },
  itemInner: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 10, fontFamily: FONTS.sansMedium, letterSpacing: 0.2 },
  indicator: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-start' },
  indicatorHorizontal: { top: -8, left: 0, height: 3 },
  indicatorVertical: { left: -1, top: 0, width: 3, justifyContent: 'center' },
  indicatorPill: { width: 28, height: 3, borderRadius: 2 },
  indicatorPillVertical: { width: 3, height: 28 },
});
