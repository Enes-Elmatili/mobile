// app/request/[id]/quote-pending.tsx
// Route conservée pour les liens profonds et les anciennes notifications :
// l'attente du devis est un stade du suivi (missionview), plus une page.
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function QuotePendingRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  useEffect(() => {
    if (id) router.replace({ pathname: '/request/[id]/missionview', params: { id: String(id) } });
    else router.replace('/(tabs)/dashboard');
  }, [id, router]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
      <ActivityIndicator size="small" color={theme.textMuted as string} />
    </View>
  );
}
