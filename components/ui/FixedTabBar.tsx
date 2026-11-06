// components/ui/FixedTabBar.tsx
// Tab bar custom d'Expo Router. Deux dispositions, un seul composant :
//   compact  → une pilule de verre qui FLOTTE au-dessus du contenu (Liquid
//              Glass sur iOS 26, verre dépoli avant, fond teinté sur Android),
//              une capsule qui GLISSE sous l'onglet actif (moment 15), l'icône
//              se redresse (TabIcon) ; à droite, détaché, le disque d'action
//              (GO / stop / flèche côté prestataire, « + » / flèche côté client)
//              réglé par les écrans via stores/nav.
//   rail     → iPhone Duo : le système range la barre d'état dans un rail
//              vertical (côté caméra, à droite). Apple y met la tab bar, calée
//              en bas sous l'heure (HIG « Designing for iPhone Duo » : « Dynamic
//              Island, status bar, toolbar, and tab bar ») ; on y range nos
//              onglets ET le disque, à portée du pouce. Le côté suit
//              useVerticalBarEdgeIOS() (expo-status-bar), jamais supposé.
//   regular  → (sans rail : pliables Android, iPad) sidebar à gauche, même
//              capsule, verticale ; le disque flotte en bas à droite du contenu.
// La capsule repart de sa position courante (règle 1) sur MOTION.tab.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useVerticalBarEdgeIOS, type VerticalBarEdgeIOS } from 'expo-status-bar';
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
/** Largeur réelle de la sidebar : elle s'élargit de l'inset gauche (rail système
 *  du Duo tourné) au lieu de le prendre sur ses icônes. Le contenu se décale d'autant. */
export function sidebarWidth(insetLeft: number): number {
  return SIDEBAR_WIDTH + insetLeft;
}

export type TabBarMode = 'pill' | 'rail' | 'sidebar';

/** Où vit la navigation : dans le rail système s'il existe (iPhone Duo), sinon
 *  sidebar sur regular, sinon pilule flottante. Partagé avec app/(tabs)/_layout
 *  (décalage du contenu, padding bas). */
export function useTabBarMode(): { mode: TabBarMode; edge: VerticalBarEdgeIOS | null } {
  const { isRegular } = useLayoutClass();
  const edge = useVerticalBarEdgeIOS();
  if (edge) return { mode: 'rail', edge };
  return { mode: isRegular ? 'sidebar' : 'pill', edge: null };
}

/** Largeur du rail : l'inset système de son côté (84 pt mesurés sur le Duo),
 *  jamais moins que le disque et son air. */
export function railWidth(insets: { left: number; right: number }, edge: VerticalBarEdgeIOS | null): number {
  const inset = edge === 'leading' ? insets.left : insets.right;
  return Math.max(inset, DISC_SIZE + 16);
}
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

function TabItem({ label, icon, focused, color, onPress, onLongPress, vertical, accessibilityLabel, badge, testID }: {
  label: string; icon: FeatherName; focused: boolean; color: string; onPress: () => void; onLongPress: () => void; vertical: boolean; accessibilityLabel?: string; badge?: number | string | null; testID?: string;
}) {
  const press = usePressScale();
  const badgeLabel = badge != null && badge !== 0 && badge !== '' ? `, ${badge}` : '';
  return (
    <Pressable
      testID={testID}
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
          <TabIcon name={icon} color={color} focused={focused} size={24} />
          <Badge value={badge} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function FixedTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const theme = useAppTheme();
  const { mode, edge } = useTabBarMode();
  // Rail et sidebar : onglets empilés, capsule verticale.
  const vertical = mode !== 'pill';
  const reduced = useReduceMotion();
  const disc = useNavStore((st) => st.disc);
  const badges = useNavStore((st) => st.badges);
  const barHidden = useNavStore((st) => st.barHidden || st.barLocks > 0);

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
    const slot = vertical ? size.h / count : (size.w - TRACK_PAD * 2) / count;
    return vertical
      ? { transform: [{ translateY: indicator.value * slot }], height: slot }
      : { transform: [{ translateX: indicator.value * slot }], width: slot };
  });

  const bottom = tabBarBottom(insets.bottom);
  const discNode = <ActionDisc kind={disc.kind} onPress={disc.onPress} label={disc.label} />;

  // La barre glisse sous l'écran quand une fiche prend tout l'écran (demande
  // entrante) ; elle repart de sa position courante si l'état change en route.
  const away = useSharedValue(barHidden ? 1 : 0);
  useEffect(() => {
    away.value = reduced ? withTiming(barHidden ? 1 : 0, { duration: 150 }) : withSpring(barHidden ? 1 : 0, MOTION.tab);
  }, [barHidden, reduced, away]);
  const awayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: away.value * (TAB_BAR_HEIGHT + bottom + 24) }],
    opacity: 1 - away.value * 0.4,
  }));
  // Dans le rail, la barre sort par son bord (vers la droite si le rail est à droite).
  const railSide = edge === 'leading' ? 'left' : 'right';
  const railW = railWidth(insets, edge);
  const railAwayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: away.value * (railW + 24) * (railSide === 'right' ? 1 : -1) }],
    opacity: 1 - away.value * 0.4,
  }));

  const items = routes.map((route) => {
    const { options } = descriptors[route.key];
    const focused = route.key === activeKey;
    const label = typeof options.title === 'string' ? options.title : route.name;
    const color = focused ? (theme.text as string) : (theme.textMuted as string);
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        feedback.haptic('selection');
        navigateToTab(route.key);
      }
    };
    const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });
    return (
      <TabItem
        key={route.key}
        label={label}
        icon={TAB_ICONS[route.name] ?? 'circle'}
        focused={focused}
        color={color}
        onPress={onPress}
        onLongPress={onLongPress}
        vertical={vertical}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        badge={badges[route.name as keyof Badges]}
        testID={`tab-${route.name}`}
      />
    );
  });

  const capsule = (
    <Animated.View pointerEvents="none" style={[s.indicator, vertical ? s.indicatorVertical : s.indicatorHorizontal, indicatorStyle]}>
      <View style={[s.capsule, vertical && s.capsuleVertical, { backgroundColor: alpha(theme.text, theme.isDark ? 0.14 : 0.09) }]} />
    </Animated.View>
  );

  // Rail (iPhone Duo) : onglets puis disque, calés en bas du rail système, sous
  // l'heure et la caméra qui en occupent le haut. Pas de fond : le rail est la
  // surface de l'app, comme pour la tab bar native.
  if (mode === 'rail') {
    return (
      <Animated.View
        testID="tab-rail"
        style={[s.rail, railSide === 'right' ? { right: 0 } : { left: 0 }, { width: railW, paddingBottom: Math.max(insets.bottom, 12) }, railAwayStyle]}
        pointerEvents={barHidden ? 'none' : 'box-none'}
      >
        <View style={[s.track, s.trackVertical, s.trackRail]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {capsule}
          {items}
        </View>
        <View style={s.railGap} pointerEvents="none" />
        {discNode}
      </Animated.View>
    );
  }

  if (mode === 'sidebar') {
    return (
      <>
        <View style={[s.sidebar, { width: sidebarWidth(insets.left), paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingLeft: insets.left, borderRightColor: theme.border, backgroundColor: alpha(theme.bg, 0.98) }]}>
          <View style={[s.track, s.trackVertical]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {capsule}
            {items}
          </View>
        </View>
        <Animated.View style={[s.discSlot, { right: TAB_BAR_MARGIN + 8 + insets.right, bottom }, awayStyle]} pointerEvents={barHidden ? 'none' : 'box-none'}>{discNode}</Animated.View>
      </>
    );
  }

  return (
    <Animated.View style={[s.float, { bottom, left: TAB_BAR_MARGIN + insets.left, right: TAB_BAR_MARGIN + insets.right }, awayStyle]} pointerEvents={barHidden ? 'none' : 'box-none'}>
      <View style={s.pill}>
        <GlassSurface style={s.pillShape} interactive />
        <View style={s.track} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {capsule}
          {items}
        </View>
      </View>
      <View style={s.discGap} pointerEvents="none" />
      {discNode}
    </Animated.View>
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
  // Colonne à sa taille naturelle (n × itemVertical) : la capsule prend la
  // hauteur d'UN onglet. En flex: 1 elle mesurait toute la sidebar et la capsule
  // couvrait tous les onglets.
  trackVertical: { flex: 0, flexDirection: 'column', paddingHorizontal: 0 },
  rail: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  // Sur toute la largeur du rail : la capsule garde son air de chaque côté.
  trackRail: { alignSelf: 'stretch' },
  railGap: { height: 12 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemVertical: { flex: 0, height: 60 },
  // Icônes seules : le nom de l'onglet reste annoncé par le lecteur d'écran (accessibilityLabel).
  itemInner: { alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  indicatorHorizontal: { top: 0, bottom: 0, left: TRACK_PAD },
  indicatorVertical: { left: 0, right: 0, top: 0 },
  capsule: { position: 'absolute', left: 6, right: 6, top: 8, bottom: 8, borderRadius: (TAB_BAR_HEIGHT - 16) / 2 },
  capsuleVertical: { left: 10, right: 10, top: 6, bottom: 6, borderRadius: 18 },
  badge: { position: 'absolute', top: -5, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: COLORS.amber, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FONTS.sansBold, fontSize: 10, color: '#0A0A0A', includeFontPadding: false },
});
