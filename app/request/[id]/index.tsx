/* eslint-disable import/no-unresolved */
import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

export default function Wallet() {
  const router = useRouter();
  const theme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const [balResult, txResult] = await Promise.allSettled([
        api.wallet.balance(),
        api.wallet.transactions(20),
      ]);
      if (balResult.status === 'fulfilled') setBalance((balResult.value as any).balance ?? 0);
      if (txResult.status === 'fulfilled') setTransactions(txResult.value as any ?? []);
    } catch (error) {
      devError('Wallet load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTransaction = ({ item }: any) => (
    <View style={[styles.txCard, { backgroundColor: theme.cardBg }]}>
      <View style={[styles.txIcon, { backgroundColor: theme.surface }]}>
        <Ionicons
          name={item.type === 'CREDIT' ? 'arrow-down' : 'arrow-up'}
          size={20}
          color={item.type === 'CREDIT' ? COLORS.green : COLORS.red}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{item.type}</Text>
        <Text style={[styles.txDate, { color: theme.textMuted, fontFamily: FONTS.mono }]}>
          {new Date(item.createdAt).toLocaleString('fr-FR')}
        </Text>
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: item.type === 'CREDIT' ? COLORS.green : COLORS.red, fontFamily: FONTS.monoMedium },
        ]}
      >
        {item.type === 'CREDIT' ? '+' : '-'}€{Math.abs(item.amount).toFixed(2)}
      </Text>
    </View>
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
        <Text style={[styles.title, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Portefeuille</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.balanceCard, { backgroundColor: theme.heroBg }]}>
        <Text style={[styles.balanceLabel, { color: theme.heroSub, fontFamily: FONTS.sansMedium }]}>Solde actuel</Text>
        <Text style={[styles.balanceAmount, { color: theme.heroText, fontFamily: FONTS.bebas }]}>€{balance.toFixed(2)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Transactions récentes</Text>
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={64} color={theme.textDisabled} />
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Aucune transaction</Text>
            </View>
          }
        />
      </View>
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
  balanceCard: {
    margin: 20,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 14, marginBottom: 8 },
  balanceAmount: { fontSize: 44 },
  section: { paddingHorizontal: 20, flex: 1 },
  sectionTitle: { fontSize: 18, marginBottom: 16 },
  txCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 16 },
  txDate: { fontSize: 12, marginTop: 4 },
  txAmount: { fontSize: 18 },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: { fontSize: 16, marginTop: 12 },
});
