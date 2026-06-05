// app/(tabs)/_layout.tsx
// TabBar "Frosted Glass" — BlurView translucide, rôle-aware, dark mode system-adaptive
//
// CLIENT  : Accueil · Documents · Profil
// PROVIDER: Accueil · Opportunités · Missions · Gains · Profil
//
// Prérequis : npx expo install expo-blur

import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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
    title: t('ext.tabs_home'),
    tabBarIcon: ({ color }: { focused: boolean; color: string }) =>
      <Feather name="home" size={22} color={color} />,
  }), [t]);

  const opportunitiesOptions = useMemo(() => ({
    title: t('ext.tabs_opportunities'),
    href: null as null,
    tabBarIcon: ({ color }: { focused: boolean; color: string }) =>
      <Feather name="compass" size={22} color={color} />,
  }), [t]);

  const missionsOptions = useMemo(() => ({
    title: t('ext.tabs_missions'),
    href: isProvider ? undefined : null,
    tabBarIcon: ({ color }: { focused: boolean; color: string }) =>
      <Feather name="zap" size={22} color={color} />,
  }), [isProvider, t]);

  const documentsOptions = useMemo(() => ({
    title: t('ext.tabs_documents'),
    href: isProvider ? null : undefined,
    tabBarIcon: ({ color }: { focused: boolean; color: string }) =>
      <Feather name="file-text" size={22} color={color} />,
  }), [isProvider, t]);

  const walletOptions = useMemo(() => ({
    title: t('ext.tabs_earnings'),
    href: isProvider ? undefined : null,
    tabBarIcon: ({ color }: { focused: boolean; color: string }) =>
      <Feather name="credit-card" size={22} color={color} />,
  }), [isProvider, t]);

  const profileOptions = useMemo(() => ({
    title: t('ext.tabs_profile'),
    tabBarIcon: ({ color }: { focused: boolean; color: string }) =>
      <Feather name="user" size={22} color={color} />,
  }), [t]);

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
