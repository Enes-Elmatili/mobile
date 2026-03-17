import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

export default function ProvidersListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await api.providers.list();
      setProviders(response.data || response || []);
    } catch (error) {
      devError('Providers load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProvider = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}
      onPress={() => {
        router.push({
          pathname: '/providers/[id]',
          params: { id: item.id },
        });
      }}
    >
      <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
        <Ionicons name="person" size={32} color={theme.textAlt} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{item.name || item.email}</Text>
        <Text style={[styles.email, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{item.email}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={theme.textMuted} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Providers</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={providers}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color={theme.textDisabled} />
            <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Aucun provider disponible</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20 },
  list: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { fontSize: 16 },
  email: { fontSize: 14, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, marginTop: 16 },
});
