// app/(tabs)/_layout.tsx
// TabBar "Frosted Glass" — BlurView translucide, rôle-aware, dark mode system-adaptive
//
// CLIENT  : Accueil · Documents · Profil
// PROVIDER: Accueil · Opportunités · Missions · Gains · Profil
//
// Prérequis : npx expo install expo-blur

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

const TAB_HEIGHT = Platform.OS === 'ios' ? 70 : 54;
const TAB_PB     = Platform.OS === 'ios' ? 20 : 8;

// ─── Background BlurView — frosted glass natif ────────────────────────────────
function TabBarBackground() {
  const theme = useAppTheme();

  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 55 : 40}
      tint={theme.isDark ? 'dark' : 'light'}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const theme    = useAppTheme();

  // ── Stable boolean — ne change que si les rôles changent réellement ───────
  // useMemo évite de recalculer isProvider sur chaque re-render provoqué par
  // un changement de référence de l'objet `user` (même données, nouvel objet).
  const rolesKey   = user?.roles?.join(',') ?? '';
  const isProvider = useMemo(() => rolesKey.includes('PROVIDER'), [rolesKey]);

  // ── tabBarBackground stable — évite une nouvelle référence à chaque render ─
  // Sans useCallback, React Navigation détecte un changement d'options à chaque
  // render et peut déclencher des mises à jour imbriquées (→ update depth exceeded)
  const renderTabBarBackground = useCallback(() => <TabBarBackground />, []);

  // ── screenOptions stable ──────────────────────────────────────────────────
  const screenOptions = useMemo(() => ({
    headerShown: false,
    contentStyle: { backgroundColor: theme.bg },
    tabBarActiveTintColor:   theme.accent,
    tabBarInactiveTintColor: theme.textMuted,
    tabBarShowLabel: true,
    tabBarLabelStyle: {
      fontSize:      10,
      fontFamily:    FONTS.sansMedium,
      letterSpacing: 0.2,
      marginTop:     -2,
    },
    tabBarStyle: {
      position:        'absolute' as const,
      backgroundColor: 'transparent',
      borderTopWidth:  1,
      borderTopColor:  theme.border,
      height:          TAB_HEIGHT,
      paddingTop:      10,
      paddingBottom:   TAB_PB,
      elevation:       0,
      shadowOpacity:   0,
    },
    tabBarBackground: renderTabBarBackground,
  }), [theme.bg, theme.accent, theme.textMuted, theme.border, renderTabBarBackground]);

  // ── Options par onglet — entièrement mémoïsées ───────────────────────────
  // Expo Router lit les options de chaque <Tabs.Screen> dans un useLayoutEffect
  // interne. Si l'objet options est recréé à chaque render (tabBarIcon inline),
  // l'effet re-dispatche → boucle. useMemo garantit une référence stable.

  const dashboardOptions = useMemo(() => ({
    title: 'Accueil',
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) =>
      <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />,
  }), []);

  const opportunitiesOptions = useMemo(() => ({
    title: 'Opportunités',
    href: null as null,
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) =>
      <Ionicons name={focused ? 'compass' : 'compass-outline'} size={22} color={color} />,
  }), []);

  const missionsOptions = useMemo(() => ({
    title: 'Missions',
    href: isProvider ? undefined : null,
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) =>
      <Ionicons name={focused ? 'flash' : 'flash-outline'} size={22} color={color} />,
  }), [isProvider]);

  const documentsOptions = useMemo(() => ({
    title: 'Documents',
    href: isProvider ? null : undefined,
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) =>
      <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />,
  }), [isProvider]);

  const walletOptions = useMemo(() => ({
    title: 'Gains',
    href: isProvider ? undefined : null,
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) =>
      <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />,
  }), [isProvider]);

  const profileOptions = useMemo(() => ({
    title: 'Profil',
    tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) =>
      <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />,
  }), []);

  const hiddenOptions = useMemo(() => ({ href: null as null }), []);

  return (
    <Tabs screenOptions={screenOptions}>

      {/* ── 1. ACCUEIL — tous les rôles ─────────────────────────────────── */}
      <Tabs.Screen name="dashboard"         options={dashboardOptions}  />

      {/* ── 2. OPPORTUNITÉS — Provider seulement ───────────────────────── */}
      <Tabs.Screen name="opportunities"     options={opportunitiesOptions} />

      {/* ── 3. MISSIONS — Provider seulement ────────────────────────────── */}
      <Tabs.Screen name="missions"          options={missionsOptions}   />

      {/* ── 3. DOCUMENTS — Client seulement ─────────────────────────────── */}
      <Tabs.Screen name="documents"         options={documentsOptions}  />

      {/* ── 4. GAINS (wallet) — Provider seulement ──────────────────────── */}
      <Tabs.Screen name="wallet"            options={walletOptions}     />

      {/* ── 5. PROFIL — tous les rôles ──────────────────────────────────── */}
      <Tabs.Screen name="profile"           options={profileOptions}    />

      {/* ── Routes utilitaires cachées ───────────────────────────────────── */}
      <Tabs.Screen name="provider-dashboard" options={hiddenOptions}   />

    </Tabs>
  );
}
