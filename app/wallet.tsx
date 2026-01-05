import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';

export default function Wallet() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const [balanceData, txData] = await Promise.all([
        api.wallet.balance(),
        api.wallet.transactions(20),
      ]);
      setBalance(balanceData.balance || 0);
      setTransactions(txData.transactions || txData || []);
    } catch (error) {
      console.error('Wallet load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTransaction = ({ item }: any) => (
    <View style={styles.txCard}>
      <View style={styles.txIcon}>
        <Ionicons
          name={item.type === 'CREDIT' ? 'arrow-down' : 'arrow-up'}
          size={20}
          color={item.type === 'CREDIT' ? '#10B981' : '#EF4444'}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>{item.type}</Text>
        <Text style={styles.txDate}>
          {new Date(item.createdAt).toLocaleString('fr-FR')}
        </Text>
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: item.type === 'CREDIT' ? '#10B981' : '#EF4444' },
        ]}
      >
        {item.type === 'CREDIT' ? '+' : '-'}€{Math.abs(item.amount).toFixed(2)}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#172247" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Portefeuille</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde actuel</Text>
        <Text style={styles.balanceAmount}>€{balance.toFixed(2)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transactions récentes</Text>
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item, index) => item.id || index.toString()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  balanceCard: {
    backgroundColor: '#172247',
    margin: 20,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 14, color: '#D1D5DB', marginBottom: 8 },
  balanceAmount: { fontSize: 40, fontWeight: '700', color: '#fff' },
  section: { paddingHorizontal: 20, flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  txCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  txDate: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  txAmount: { fontSize: 18, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
});