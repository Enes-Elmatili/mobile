// components/ui/FixedTabBar.tsx
// Tab bar custom d'Expo Router. Deux dispositions, un seul composant :
//   compact  → une pilule de verre qui FLOTTE au-dessus du contenu (Liquid
//              Glass sur iOS 26, verre dépoli avant, fond teinté sur Android),
//              une capsule qui GLISSE sous l'onglet actif (moment 15), l'icône
//              se redresse (TabIcon) ; à droite, détaché, le disque d'action
//              (GO / stop / flèche côté prestataire, « + » / flèche côté client)
//              réglé par les écrans via stores/nav.
//   regular  → sidebar à gauche (Apple : la tab bar devient une sidebar sur
//              les largeurs regular), même capsule, verticale ; le disque
//              flotte en bas à droite du contenu.
// La capsule repart de sa position courante (règle 1) sur MOTION.tab.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAppTheme, FONTS, COLORS, alpha } from '@/hooks/use-app-theme';
import { useLayoutClass } from '@/lib/layout/useLayoutClass';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { useNavStore, type Badges } from '@/stores/nav';
import { ActionDisc, DISC_SIZE } from '@/components/nav/ActionDisc';
import { GlassSurface } from '@/components/nav/GlassSurface';
import { TabIcon } from './TabIcon';

type FeatherName = React.ComponentProps<typeof TabIcon>['name'];

/** Hauteur de la pilule (et du disque, alignés). */
export const TAB_BAR_HEIGHT = 64;
/** Largeur de la sidebar sur regular. */
export const SIDEBAR_WIDTH = 88;
/** Marge latérale de la pilule et du disque. */
export const TAB_BAR_MARGIN = 16;
/** Espace entre la pilule et le disque. */
const DISC_GAP = 12;
/** Plancher de l'inset bas (devices sans home indicator). */
const TAB_PB = 12;
/** La pilule flotte au-dessus de l'inset. */
const FLOAT_GAP = 10;
/** Marge intérieure de la rangée d'onglets dans la pilule. */
const TRACK_PAD = 6;

/** Distance entre le bas de l'écran et le bas de la pilule / du disque. */
export function tabBarBottom(insetBottom: number): number {
  return Math.max(insetBottom, TAB_PB) + FLOAT_GAP;
}

/** Icônes par nom de route — la source unique, lue aussi par app/(tabs)/_layout.tsx. */
export const TAB_ICONS: Record<string, FeatherName> = {
  dashboard: 'home',
  missions: 'zap',
  documents: 'file-text',
  wallet: 'credit-card',
  profile: 'user',
};

/** Le badge d'un onglet : un compte ambre (Missions), un « ! » (Profil). */
function Badge({ value }: { value: number | string | null | undefined }) {
  if (value == null || value === 0 || value === '') return null;
  const text = typeof value === 'number' ? (value > 99 ? '99+' : String(value)) : value;
  return (
    <View style={s.badge} pointerEvents="none" accessibilityElementsHidden>
      <Text style={s.badgeText} maxFontSizeMultiplier={1}>{text}</Text>
    </View>
  );
}

function TabItem({ label, icon, focused, color, onPress, onLongPress, vertical, accessibilityLabel, badge }: {
  label: string; icon: FeatherName; focused: boolean; color: string; onPress: () => void; onLongPress: () => void; vertical: boolean; accessibilityLabel?: string; badge?: number | string | null;
}) {
  const press = usePressScale();
  const badgeLabel = badge != null && badge !== 0 && badge !== '' ? `, ${badge}` : '';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={(accessibilityLabel ?? label) + badgeLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[s.item, vertical && s.itemVertical]}
    >
      <Animated.View style={[s.itemInner, press.style]}>
        <View>
          <TabIcon name={icon} color={color} focused={focused} />
          <Badge value={badge} />
        </View>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[s.label, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function FixedTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useAppTheme();
  const { isRegular } = useLayoutClass();
  const reduced = useReduceMotion();
  const disc = useNavStore((st) => st.disc);
  const badges = useNavStore((st) => st.badges);

  // Onglets visibles. Expo Router ne transmet PAS `href` aux descripteurs :
  // il le retire des options et marque la route cachée (`href: null`) avec
  // `tabBarItemStyle: { display: 'none' }` et un `tabBarButton` qui rend null.
  // Filtrer sur `href` laissait donc passer les onglets de l'autre rôle
  // (Missions et Gains chez le client, Documents chez le prestataire).
  // Vérifié de bout en bout dans __tests__/fixedTabBar.router.test.js (vrai
  // Expo Router). Le test sur `href` reste en ceinture : inerte aujourd'hui,
  // il couvrirait une version du routeur qui transmettrait la prop.
  const routes = state.routes.filter((r) => {
    const options = descriptors[r.key].options as { tabBarItemStyle?: unknown; href?: unknown };
    if (options.href === null) return false;
    const style = StyleSheet.flatten(options.tabBarItemStyle as StyleProp<ViewStyle>);
    return style?.display !== 'none';
  });
  // Route active. Le prestataire atterrit sur `provider-dashboard`, une route
  // cachée (href: null) rendue par le même écran qu'Accueil : dans ce cas
  // l'onglet Accueil est celui qu'on marque, sinon aucun onglet ne serait
  // sélectionné alors que la capsule se pose dessous.
  const currentKey = state.routes[state.index]?.key;
  const visibleIndex = routes.findIndex((r) => r.key === currentKey);
  const activeIndex = Math.max(0, visibleIndex);
  const activeKey = routes[activeIndex]?.key;

  const indicator = useSharedValue(activeIndex);
  useEffect(() => {
    indicator.value = reduced ? withTiming(activeIndex, { duration: 120 }) : withSpring(activeIndex, MOTION.tab);
  }, [activeIndex, reduced, indicator]);

  const count = Math.max(1, routes.length);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const indicatorStyle = useAnimatedStyle(() => {
    const slot = isRegular ? size.h / count : (size.w - TRACK_PAD * 2) / count;
    return isRegular
      ? { transform: [{ translateY: indicator.value * slot }], height: slot }
      : { transform: [{ translateX: indicator.value * slot }], width: slot };
  });

  const bottom = tabBarBottom(insets.bottom);
  const discNode = <ActionDisc kind={disc.kind} onPress={disc.onPress} label={disc.label} />;

  const items = routes.map((route) => {
    const { options } = descriptors[route.key];
    const focused = route.key === activeKey;
    const label = typeof options.title === 'string' ? options.title : route.name;
    const color = focused ? (theme.text as string) : (theme.textMuted as string);
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
        badge={badges[route.name as keyof Badges]}
      />
    );
  });

  const capsule = (
    <Animated.View pointerEvents="none" style={[s.indicator, isRegular ? s.indicatorVertical : s.indicatorHorizontal, indicatorStyle]}>
      <View style={[s.capsule, isRegular && s.capsuleVertical, { backgroundColor: alpha(theme.text, theme.isDark ? 0.14 : 0.09) }]} />
    </Animated.View>
  );

  if (isRegular) {
    return (
      <>
        <View style={[s.sidebar, { width: SIDEBAR_WIDTH, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingLeft: insets.left, borderRightColor: theme.border, backgroundColor: alpha(theme.bg, 0.98) }]}>
          <View style={[s.track, s.trackVertical]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {capsule}
            {items}
          </View>
        </View>
        <View style={[s.discSlot, { right: TAB_BAR_MARGIN + 8 + insets.right, bottom }]} pointerEvents="box-none">{discNode}</View>
      </>
    );
  }

  return (
    <View style={[s.float, { bottom, left: TAB_BAR_MARGIN + insets.left, right: TAB_BAR_MARGIN + insets.right }]} pointerEvents="box-none">
      <View style={s.pill}>
        <GlassSurface style={s.pillShape} interactive />
        <View style={s.track} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {capsule}
          {items}
        </View>
      </View>
      <View style={s.discGap} pointerEvents="none" />
      {discNode}
    </View>
  );
}

const s = StyleSheet.create({
  float: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end', height: TAB_BAR_HEIGHT },
  pill: { flex: 1, height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2 },
  pillShape: { borderRadius: TAB_BAR_HEIGHT / 2 },
  discGap: { width: DISC_GAP },
  discSlot: { position: 'absolute', width: DISC_SIZE, height: DISC_SIZE },
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRightWidth: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row', paddingHorizontal: TRACK_PAD },
  trackVertical: { flexDirection: 'column', paddingHorizontal: 0 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemVertical: { flex: 0, height: 72 },
  itemInner: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10, fontFamily: FONTS.sansMedium, letterSpacing: 0.2 },
  indicator: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  indicatorHorizontal: { top: 0, bottom: 0, left: TRACK_PAD },
  indicatorVertical: { left: 0, right: 0, top: 0 },
  capsule: { position: 'absolute', left: 6, right: 6, top: 8, bottom: 8, borderRadius: (TAB_BAR_HEIGHT - 16) / 2 },
  capsuleVertical: { left: 10, right: 10, top: 6, bottom: 6, borderRadius: 18 },
  badge: { position: 'absolute', top: -5, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: COLORS.amber, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FONTS.sansBold, fontSize: 10, color: '#0A0A0A', includeFontPadding: false },
});
