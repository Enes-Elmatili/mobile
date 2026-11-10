// components/dashboard/DashboardSkeleton.tsx — shown during cold load instead
// of a blank spinner. Mirrors the shell of the real dashboard (topbar, runway,
// CTA, island, list) with a subtle pulse so the layout doesn't reflow when data arrives.
// Duo déplié : les deux pages de l'accueil (commander | suivre), de part et
// d'autre du pli, comme le vrai tableau de bord (SplitPane, ratio 0,5).
import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AppTheme } from '@/hooks/use-app-theme';
import { BookSpread, useSplitPane } from '@/lib/layout';

export function DashboardSkeleton({ theme }: { theme: AppTheme }) {
  const isSplit = useSplitPane();
  // Moment 18 : les blocs respirent (composant partagé <Skeleton />) ; le contenu
  // réel arrive ensuite en cascade dans la même géométrie.
  const order = (
    <>
        {/* Topbar */}
        <View style={s.topbar}>
          <View>
            <Skeleton w={100} h={10} style={{ marginBottom: 8 }} />
            <Skeleton w={160} h={28} />
          </View>
          <View style={s.topbarActions}>
            <Skeleton w={36} h={36} style={{ borderRadius: 10 }} />
            <Skeleton w={36} h={36} style={{ borderRadius: 10 }} />
          </View>
        </View>

        {/* Hero CTA */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Skeleton w="100%" h={200} style={{ borderRadius: 20 }} />
        </View>
    </>
  );
  const upcoming = (
    <>
        {/* Mission island */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Skeleton w={80} h={10} />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <Skeleton w="100%" h={70} style={{ borderRadius: 12 }} />
        </View>

    </>
  );
  const services = (
    <>
        {/* Services grid */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Skeleton w={70} h={10} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10 }}>
          <Skeleton w="48%" h={100} style={{ borderRadius: 18 }} />
          <Skeleton w="48%" h={100} style={{ borderRadius: 18 }} />
        </View>

    </>
  );
  const activity = (
    <>
        {/* Activity */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Skeleton w={100} h={10} />
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <Skeleton w="100%" h={68} style={{ borderRadius: 18 }} />
          <Skeleton w="100%" h={68} style={{ borderRadius: 18 }} />
          <Skeleton w="100%" h={68} style={{ borderRadius: 18 }} />
        </View>
    </>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {isSplit ? (
        // Même découpage que l'accueil : en-tête + îlot + services à gauche,
        // à venir + activité à droite. Statique : aucune entrée de volet.
        <BookSpread
          left={<View style={{ paddingBottom: 32 }}>{order}{services}</View>}
          right={<View style={{ paddingBottom: 32 }}>{upcoming}{activity}</View>}
        />
      ) : (
      <View style={{ paddingBottom: 32 }}>
        {order}
        {upcoming}
        {services}
        {activity}
      </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14,
  },
  topbarActions: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sectionHead: {
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
});
