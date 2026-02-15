import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import TicketDetailSheet from '../../components/sheets/TicketDetailSheet';

export default function Documents() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // ✅ État pour le BottomSheet (objet complet au lieu de l'ID)
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const loadTickets = async (pageNum = 1) => {
    try {
      console.log('📡 Loading tickets page', pageNum);
      const response = await api.requests.list({ page: pageNum, limit: 5 });
      console.log('✅ Tickets data:', response);
      
      const ticketsData = response.data || response;
      setTickets(Array.isArray(ticketsData) ? ticketsData : []);
      
      if (response.total) {
        setTotalPages(Math.ceil(response.total / 5));
      }
    } catch (error) {
      console.error('❌ Tickets load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets(page);
  }, [page]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTickets(page);
  };

  // ✅ Ouvre le BottomSheet avec l'objet complet
  const handleTicketPress = (ticket: any) => {
    console.log('🔍 Opening ticket:', ticket);
    setSelectedTicket(ticket);
  };

  // ✅ Ferme le BottomSheet
  const handleCloseSheet = () => {
    setSelectedTicket(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Vos documents</Text>
      
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Tickets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ticket-outline" size={24} color="#000" />
            <Text style={styles.sectionTitle}>Tickets</Text>
          </View>

          <View style={styles.card}>
            {tickets.length === 0 ? (
              <Text style={styles.emptyText}>Aucun ticket disponible</Text>
            ) : (
              <>
                {tickets.map((ticket, index) => (
                  <TouchableOpacity
                    key={ticket.id}
                    style={[
                      styles.listItem,
                      index < tickets.length - 1 && styles.listItemBorder,
                    ]}
                    onPress={() => handleTicketPress(ticket)}
                  >
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>
                        Ticket #{String(ticket.id).slice(-6)} – {ticket.serviceType || ticket.title || 'Sans titre'}
                      </Text>
                      <Text style={styles.listItemDate}>
                        {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <View style={styles.pagination}>
                    <TouchableOpacity
                      style={[styles.paginationBtn, page === 1 && styles.paginationBtnDisabled]}
                      onPress={() => page > 1 && setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <Ionicons name="chevron-back" size={20} color={page === 1 ? '#CCC' : '#000'} />
                    </TouchableOpacity>
                    <Text style={styles.paginationText}>
                      {page} / {totalPages}
                    </Text>
                    <TouchableOpacity
                      style={[styles.paginationBtn, page === totalPages && styles.paginationBtnDisabled]}
                      onPress={() => page < totalPages && setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      <Ionicons name="chevron-forward" size={20} color={page === totalPages ? '#CCC' : '#000'} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Contrats Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={24} color="#000" />
            <Text style={styles.sectionTitle}>Contrats</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.emptyText}>Retrouvez vos contrats ici.</Text>
          </View>
        </View>

        {/* Factures Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={24} color="#000" />
            <Text style={styles.sectionTitle}>Factures</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.emptyText}>Aucune facture disponible.</Text>
          </View>
        </View>
      </ScrollView>

      {/* ✅ BottomSheet pour afficher les détails du ticket */}
      <TicketDetailSheet
        ticket={selectedTicket}
        isVisible={!!selectedTicket}
        onClose={handleCloseSheet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  listItemDate: {
    fontSize: 13,
    color: '#999',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  paginationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationBtnDisabled: {
    opacity: 0.3,
  },
  paginationText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
