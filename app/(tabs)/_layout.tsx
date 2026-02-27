// app/(tabs)/_layout.tsx
// TabBar "Frosted Glass" — BlurView translucide, rôle-aware, dark mode system-adaptive
//
// CLIENT  : Accueil · Documents · Profil
// PROVIDER: Accueil · Missions  · Gains  · Profil
//
// Prérequis : npx expo install expo-blur

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/lib/auth/AuthContext';

const TAB_HEIGHT = Platform.OS === 'ios' ? 84 : 62;
const TAB_PB     = Platform.OS === 'ios' ? 26 : 10;

// ─── Background BlurView — frosted glass natif ────────────────────────────────
function TabBarBackground() {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 55 : 40}
      tint={isDark ? 'dark' : 'light'}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabLayout() {
  const { user }    = useAuth();
  const isProvider  = user?.roles?.includes('PROVIDER');
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

  // ── Palette adaptative ────────────────────────────────────────────────────
  const activeColor   = isDark ? '#FFFFFF' : '#0A0A0A';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  const borderColor   = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // ── Couleurs adaptatives ──────────────────────────────────────────
        tabBarActiveTintColor:   activeColor,
        tabBarInactiveTintColor: inactiveColor,

        // ── Labels ───────────────────────────────────────────────────────
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize:      10,
          fontWeight:    '600',
          letterSpacing: 0.2,
          marginTop:     -2,
        },

        // ── Barre transparente — le BlurView gère le fond ─────────────
        tabBarStyle: {
          position:        'absolute',
          backgroundColor: 'transparent',
          borderTopWidth:  1,
          borderTopColor:  borderColor,
          height:          TAB_HEIGHT,
          paddingTop:      10,
          paddingBottom:   TAB_PB,
          elevation:       0,
          shadowOpacity:   0,
        },

        tabBarBackground: () => <TabBarBackground />,
      }}
    >

      {/* ── 1. ACCUEIL — tous les rôles ─────────────────────────────────── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* ── 2. MISSIONS — Provider seulement ────────────────────────────── */}
      <Tabs.Screen
        name="missions"
        options={{
          title: 'Missions',
          href: isProvider ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'flash' : 'flash-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* ── 3. DOCUMENTS — Client seulement ─────────────────────────────── */}
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          href: isProvider ? null : undefined,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* ── 4. GAINS (wallet) — Provider seulement ──────────────────────── */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Gains',
          href: isProvider ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* ── 5. PROFIL — tous les rôles ──────────────────────────────────── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* ── Routes utilitaires cachées ───────────────────────────────────── */}
      <Tabs.Screen name="provider-dashboard" options={{ href: null }} />

    </Tabs>
  );
}