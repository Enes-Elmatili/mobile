// components/dashboard/DashboardSkeleton.tsx — shown during cold load instead
// of a blank spinner. Mirrors the shell of the real dashboard (topbar, runway,
// CTA, island, list) with a subtle pulse so the layout doesn't reflow when data arrives.
import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AppTheme } from '@/hooks/use-app-theme';

export function DashboardSkeleton({ theme }: { theme: AppTheme }) {
  // Moment 18 : les blocs respirent (composant partagé) ; le contenu réel
  // arrive ensuite en cascade dans la même géométrie.
  const Block = ({ w, h, style }: { w: number | `${number}%`; h: number; style?: object }) => (
    <Skeleton w={w} h={h} style={style} />
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={{ paddingBottom: 32 }}>
        {/* Topbar */}
        <View style={s.topbar}>
          <View>
            <Block w={100} h={10} style={{ marginBottom: 8 }} />
            <Block w={160} h={28} />
          </View>
          <View style={s.topbarActions}>
            <Block w={36} h={36} style={{ borderRadius: 10 }} />
            <Block w={36} h={36} style={{ borderRadius: 10 }} />
          </View>
        </View>

        {/* Hero CTA */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Block w="100%" h={200} style={{ borderRadius: 20 }} />
        </View>

        {/* Mission island */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={80} h={10} />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <Block w="100%" h={70} style={{ borderRadius: 12 }} />
        </View>

        {/* Services grid */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={70} h={10} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10 }}>
          <Block w="48%" h={100} style={{ borderRadius: 18 }} />
          <Block w="48%" h={100} style={{ borderRadius: 18 }} />
        </View>

        {/* Activity */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={100} h={10} />
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
        </View>
      </View>
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
