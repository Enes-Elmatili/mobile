// app/(tabs)/_layout.tsx
// Tab bar flottante (pilule de verre + disque d'action détaché — components/ui/FixedTabBar),
// rôle-aware, dark mode system-adaptive
//
// CLIENT  : Accueil · Documents · Profil
// PROVIDER: Accueil · Missions (avec onglet Opportunités interne) · Gains · Profil

import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useCallback, useMemo } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { shouldLeaveTabs } from '@/lib/providerGate';
import { TabIcon } from '@/components/ui/TabIcon';
import { FixedTabBar, SIDEBAR_WIDTH, TAB_BAR_HEIGHT as BAR_HEIGHT, tabBarBottom } from '@/components/ui/FixedTabBar';
import { useLayoutClass } from '@/lib/layout';

// Hauteur de la pilule flottante. Elle flotte à tabBarBottom(insets.bottom) du
// bas de l'écran : le haut de la pilule (et du disque) est donc à
// TAB_BAR_HEIGHT + tabBarBottom(...). Les écrans enfants compensent leur
// paddingBottom via useTabBarPadding().
export const TAB_BAR_HEIGHT = BAR_HEIGHT;

/** Padding bas à appliquer au contenu scrollable d'un écran sous la barre flottante.
 *  Sur un écran « regular », la barre est une sidebar à gauche : seul le disque
 *  flotte encore en bas à droite, on garde sa hauteur. */
export function useTabBarPadding(extra: number = 24): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + tabBarBottom(insets.bottom) + extra;
}

export default function TabLayout() {
  const { user } = useAuth();
  const theme    = useAppTheme();
  const { t } = useTranslation();
  const { isRegular } = useLayoutClass();
  // Tab bar custom : pilule flottante + disque (moment 15), sidebar sur regular.
  const renderTabBar = useCallback((props: BottomTabBarProps) => <FixedTabBar {...props} />, []);

  // ── Stable boolean — ne change que si les rôles changent réellement ───────
  // useMemo évite de recalculer isProvider sur chaque re-render provoqué par
  // un changement de référence de l'objet `user` (même données, nouvel objet).
  const rolesKey   = user?.roles?.join(',') ?? '';
  const isProvider = useMemo(() => rolesKey.includes('PROVIDER'), [rolesKey]);
  const providerStatus = user?.providerStatus;

  // ── Label custom : plafonne le Dynamic Type à 1.3× (le Label natif de React
  // Navigation n'expose que allowFontScaling booléen, pas de plafond). Rendu
  // strictement identique au style natif à l'échelle 1.0 → aucun changement visuel.
  const renderTabLabel = useCallback(
    ({ color, children }: { focused: boolean; color: string; children: string }) => (
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={{ fontSize: 10, fontFamily: FONTS.sansMedium, letterSpacing: 0.2, marginTop: -2, color }}
      >
        {children}
      </Text>
    ),
    [],
  );

  // ── screenOptions stable ──────────────────────────────────────────────────
  const screenOptions = useMemo(() => ({
    headerShown: false,
    // Sur regular la sidebar occupe la gauche : le contenu se décale.
    contentStyle: { backgroundColor: theme.bg, paddingLeft: isRegular ? SIDEBAR_WIDTH : 0 },
    tabBarActiveTintColor:   theme.accent,
    tabBarInactiveTintColor: theme.textMuted,
    tabBarShowLabel: true,
    tabBarLabelStyle: {
      fontSize:      10,
      fontFamily:    FONTS.sansMedium,
      letterSpacing: 0.2,
      marginTop:     -2,
    },
    // La barre est custom (tabBar={renderTabBar}) et flotte au-dessus du
    // contenu : rien à réserver ici, chaque écran compense via useTabBarPadding().
    tabBarStyle: { position: 'absolute' as const, backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0, shadowOpacity: 0 },
    tabBarLabel: renderTabLabel,
  }), [theme.bg, theme.accent, theme.textMuted, renderTabLabel, isRegular]);

  // ── Options par onglet — entièrement mémoïsées ───────────────────────────
  // Expo Router lit les options de chaque <Tabs.Screen> dans un useLayoutEffect
  // interne. Si l'objet options est recréé à chaque render (tabBarIcon inline),
  // l'effet re-dispatche → boucle. useMemo garantit une référence stable.

  const dashboardOptions = useMemo(() => ({
    title: t('ext.tabs_home'),
    tabBarIcon: ({ color, focused }: { focused: boolean; color: string }) =>
      <TabIcon name="home" color={color} focused={focused} />,
  }), [t]);

  const missionsOptions = useMemo(() => ({
    title: t('ext.tabs_missions'),
    href: isProvider ? undefined : null,
    tabBarIcon: ({ color, focused }: { focused: boolean; color: string }) =>
      <TabIcon name="zap" color={color} focused={focused} />,
  }), [isProvider, t]);

  const documentsOptions = useMemo(() => ({
    title: t('ext.tabs_documents'),
    href: isProvider ? null : undefined,
    tabBarIcon: ({ color, focused }: { focused: boolean; color: string }) =>
      <TabIcon name="file-text" color={color} focused={focused} />,
  }), [isProvider, t]);

  const walletOptions = useMemo(() => ({
    title: t('ext.tabs_earnings'),
    href: isProvider ? undefined : null,
    tabBarIcon: ({ color, focused }: { focused: boolean; color: string }) =>
      <TabIcon name="credit-card" color={color} focused={focused} />,
  }), [isProvider, t]);

  const profileOptions = useMemo(() => ({
    title: t('ext.tabs_profile'),
    tabBarIcon: ({ color, focused }: { focused: boolean; color: string }) =>
      <TabIcon name="user" color={color} focused={focused} />,
  }), [t]);

  const hiddenOptions = useMemo(() => ({ href: null as null }), []);

  // ── Garde de statut ───────────────────────────────────────────────────────
  // Le rôle ne suffit pas : un prestataire dont le dossier n'est pas validé
  // n'a rien à faire dans les onglets (dashboard, missions, gains). Jusqu'ici
  // seuls un démarrage à froid (app/index.tsx) ou un passage par le groupe
  // (auth) le renvoyaient vers son onboarding — toute navigation interne le
  // laissait sur le dashboard prestataire, switch « En ligne » compris.
  //
  // providerStatus indéfini = profil pas encore rafraîchi : on ne redirige pas
  // sur une valeur absente, sinon un prestataire actif se ferait éjecter le
  // temps d'un refreshMe.
  if (shouldLeaveTabs(isProvider, providerStatus)) {
    return <Redirect href="/onboarding/provider/pending" />;
  }

  return (
    <Tabs screenOptions={screenOptions} tabBar={renderTabBar}>

      {/* ── 1. ACCUEIL — tous les rôles ─────────────────────────────────── */}
      <Tabs.Screen name="dashboard"         options={dashboardOptions}  />

      {/* ── 2. MISSIONS — Provider seulement (onglet Opportunités interne) ── */}
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
