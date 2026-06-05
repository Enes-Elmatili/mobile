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
import { devError } from '@/lib/logger';
import { feedback } from '@/lib/feedback/feedback';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

export default function RequestsListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await api.requests.list();
      setRequests(response.data || response || []);
    } catch (error) {
      devError('Requests load error:', error);
      feedback.error('providers.load_error');
    } finally {
      setLoading(false);
    }
  };

  const renderRequest = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}
      onPress={() => {
        router.push({
          pathname: '/request/[id]',
          params: { id: item.id },
        });
      }}
    >
      <Text style={[styles.title, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{item.title}</Text>
      <Text style={[styles.description, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.footer}>
        <Text style={[styles.status, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{item.status}</Text>
        <Text style={[styles.price, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>
          {item.price && item.price > 0
            ? `${item.price}€`
            : ((item as any).pricingMode === 'estimate' || (item as any).pricingMode === 'diagnostic')
              ? t('dashboard.badge_quote')
              : '—'}
        </Text>
      </View>
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
        <TouchableOpacity onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}>
          <Feather name="arrow-left" size={24} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{t('ext.list_all_requests')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="file-text" size={64} color={theme.textDisabled} />
            <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('ext.list_no_requests')}</Text>
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
  headerTitle: { fontSize: 20 },
  list: { padding: 16 },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 18, marginBottom: 8 },
  description: { fontSize: 14, marginBottom: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: { fontSize: 12 },
  price: { fontSize: 18 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, marginTop: 16 },
});
