// app/(tabs)/documents.tsx — Client Document Hub
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import TicketDetailSheet from '../../components/sheets/TicketDetailSheet';

// ============================================================================
// TYPES
// ============================================================================

type Ticket = {
  id: string | number;
  serviceType?: string;
  title?: string;
  createdAt: string;
  status?: string;
  price?: number;
  address?: string;
  provider?: { name?: string };
};

type DocStatus = 'DONE' | 'CANCELLED' | 'PENDING_PAYMENT' | string;

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  DONE:            { label: 'Terminé',   color: '#059669', bg: '#ECFDF5', icon: 'checkmark-circle-outline' },
  CANCELLED:       { label: 'Annulé',    color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle-outline' },
  PENDING_PAYMENT: { label: 'Paiement',  color: '#7C3AED', bg: '#EDE9FE', icon: 'card-outline' },
  PUBLISHED:       { label: 'En attente', color: '#B45309', bg: '#FEF3C7', icon: 'time-outline' },
  ONGOING:         { label: 'En cours',  color: '#1D4ED8', bg: '#DBEAFE', icon: 'flash-outline' },
};

const getStatus = (status?: string) =>
  STATUS_CFG[status || ''] ?? { label: status || '—', color: '#6B7280', bg: '#F3F4F6', icon: 'ellipse-outline' };

// ============================================================================
// RECEIPT CARD — un justificatif dans la liste
// ============================================================================

function ReceiptCard({
  ticket,
  onPress,
  isLast,
}: {
  ticket: Ticket;
  onPress: () => void;
  isLast: boolean;
}) {
  const cfg = getStatus(ticket.status);
  const label = ticket.serviceType || ticket.title || 'Service';
  const ref = String(ticket.id).slice(-6).toUpperCase();
  const date = new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      <TouchableOpacity style={rc.row} onPress={onPress} activeOpacity={0.7}>
        {/* Icône service */}
        <View style={[rc.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name="receipt-outline" size={18} color={cfg.color} />
        </View>

        {/* Contenu */}
        <View style={rc.content}>
          <Text style={rc.label} numberOfLines={1}>{label}</Text>
          <Text style={rc.ref}>Réf. {ref} · {date}</Text>
          {/* Status badge */}
          <View style={[rc.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
            <Text style={[rc.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Prix + flèche */}
        <View style={rc.right}>
          {ticket.price != null && (
            <Text style={rc.price}>{formatEuros(ticket.price)}</Text>
          )}
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
      {!isLast && <View style={rc.divider} />}
    </>
  );
}

const rc = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  content: { flex: 1, gap: 3 },
  label: { fontSize: 14, fontWeight: '700', color: '#111' },
  ref: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    alignSelf: 'flex-start', marginTop: 2,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  right: { alignItems: 'flex-end', flexShrink: 0, gap: 2 },
  price: { fontSize: 15, fontWeight: '800', color: '#111' },
  divider: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 68 },
});

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({ icon, label, count }: { icon: string; label: string; count?: number }) {
  return (
    <View style={sh.wrap}>
      <Ionicons name={icon as any} size={15} color="#6B7280" />
      <Text style={sh.label}>{label}</Text>
      {count != null && (
        <View style={sh.badge}>
          <Text style={sh.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const sh = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, paddingHorizontal: 2,
  },
  label: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6 },
  badge: {
    backgroundColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
});

// ============================================================================
// EMPTY STATE CARD
// ============================================================================

function EmptyCard({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <View style={ec.wrap}>
      <View style={ec.iconWrap}>
        <Ionicons name={icon as any} size={26} color="#D1D5DB" />
      </View>
      <Text style={ec.text}>{text}</Text>
      {sub && <Text style={ec.sub}>{sub}</Text>}
    </View>
  );
}

const ec = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center',
  },
  text: { fontSize: 14, fontWeight: '600', color: '#374151' },
  sub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});

// ============================================================================
// CARD WRAPPER (ombre + radius)
// ============================================================================

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[cw.card, style]}>{children}</View>;
}

const cw = StyleSheet.create({
  card: {
    backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden',
    marginBottom: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
});

// ============================================================================
// PAGINATION
// ============================================================================

function Pagination({
  page, total, onPrev, onNext,
}: {
  page: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  if (total <= 1) return null;
  return (
    <View style={pg.wrap}>
      <TouchableOpacity
        style={[pg.btn, page === 1 && pg.btnDisabled]}
        onPress={onPrev}
        disabled={page === 1}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={18} color={page === 1 ? '#D1D5DB' : '#172247'} />
      </TouchableOpacity>
      <Text style={pg.text}>Page {page} sur {total}</Text>
      <TouchableOpacity
        style={[pg.btn, page === total && pg.btnDisabled]}
        onPress={onNext}
        disabled={page === total}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-forward" size={18} color={page === total ? '#D1D5DB' : '#172247'} />
      </TouchableOpacity>
    </View>
  );
}

const pg = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  btn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  text: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
});

// ============================================================================
// FILTER BAR — chips de période
// ============================================================================

function FilterBar({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (k: string) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <FlatList
      horizontal
      data={options}
      keyExtractor={item => item.key}
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' }}
      renderItem={({ item }) => {
        const active = item.key === selected;
        return (
          <TouchableOpacity
            style={[fl.chip, active && fl.chipActive]}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.8}
          >
            <Text numberOfLines={1} style={[fl.chipText, active && fl.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const fl = StyleSheet.create({
  chip: {
    paddingHorizontal: 18, paddingVertical: 0, height: 32,
    borderRadius: 20, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#172247' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#6B7280', textAlign: 'center' },
  chipTextActive: { color: '#FFF', fontWeight: '700' },
});

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function Documents() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  const loadTickets = useCallback(async (pageNum = 1) => {
    try {
      const response = await api.requests.list({ page: pageNum, limit: 5 });
      const data = response.data || response;
      setTickets(Array.isArray(data) ? data : []);
      if (response.total) setTotalPages(Math.ceil(response.total / 5));
    } catch (e) {
      console.error('Documents load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTickets(page); }, [page]);

  const onRefresh = () => { setRefreshing(true); loadTickets(page); };

  // Génère dynamiquement les mois depuis les vraies données
  const periodOptions = React.useMemo(() => {
    const monthSet = new Map<string, string>();
    tickets.forEach(t => {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      monthSet.set(key, label);
    });
    const sorted = Array.from(monthSet.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, label]) => ({ key, label }));
    return [{ key: 'all', label: 'Tous' }, ...sorted];
  }, [tickets]);

  // Filtre les tickets selon la période sélectionnée
  const filteredTickets = React.useMemo(() => {
    if (selectedPeriod === 'all') return tickets;
    return tickets.filter(t => {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedPeriod;
    });
  }, [tickets, selectedPeriod]);

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color="#172247" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Documents</Text>
          <Text style={s.headerSub}>Justificatifs et historique</Text>
        </View>
        <TouchableOpacity style={s.helpBtn} activeOpacity={0.7}
          onPress={() => {/* support */ }}
        >
          <Ionicons name="help-circle-outline" size={20} color="#172247" />
        </TouchableOpacity>
      </View>

      {/* ── Period Filter Chips ── */}
      <FilterBar
        options={periodOptions}
        selected={selectedPeriod}
        onSelect={(k) => { setSelectedPeriod(k); setPage(1); }}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#172247" />}
      >

        {/* ══ JUSTIFICATIFS DE SERVICE ══ */}
        <View style={s.section}>
          <SectionHeader
            icon="receipt-outline"
            label="Justificatifs de service"
            count={filteredTickets.length}
          />
          <Card>
            {filteredTickets.length === 0 ? (
              <EmptyCard
                icon="receipt-outline"
                text="Aucun justificatif"
                sub="Vos récapitulatifs de services apparaîtront ici une fois vos demandes terminées."
              />
            ) : (
              <>
                {filteredTickets.map((ticket, i) => (
                  <ReceiptCard
                    key={ticket.id}
                    ticket={ticket}
                    onPress={() => setSelectedTicket(ticket)}
                    isLast={i === filteredTickets.length - 1}
                  />
                ))}
                <Pagination
                  page={page}
                  total={totalPages}
                  onPrev={() => setPage(p => Math.max(1, p - 1))}
                  onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                />
              </>
            )}
          </Card>
        </View>

        {/* ══ CONTRATS ══ */}
        <View style={s.section}>
          <SectionHeader icon="document-text-outline" label="Contrats" />
          <Card>
            <EmptyCard
              icon="document-text-outline"
              text="Aucun contrat actif"
              sub="Retrouvez ici vos abonnements et contrats de maintenance récurrents."
            />
            {/* Bouton CTA si besoin futur */}
            {/* <TouchableOpacity style={s.ctaBtn}>...</TouchableOpacity> */}
          </Card>
        </View>

        {/* ══ FACTURES ══ */}
        <View style={s.section}>
          <SectionHeader icon="card-outline" label="Factures" />
          <Card>
            <EmptyCard
              icon="card-outline"
              text="Aucune facture disponible"
              sub="Vos factures officielles (PDF / Peppol) apparaîtront après chaque service facturé."
            />
          </Card>
          {/* Peppol CTA */}
          <TouchableOpacity style={s.peppolBtn} activeOpacity={0.8}>
            <View style={s.peppolIcon}>
              <Ionicons name="cloud-upload-outline" size={18} color="#7C3AED" />
            </View>
            <View style={s.peppolContent}>
              <Text style={s.peppolTitle}>Réseau Peppol</Text>
              <Text style={s.peppolSub}>Envoyez vos factures directement à votre comptabilité</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* ══ SUPPORT ══ */}
        <View style={s.section}>
          <SectionHeader icon="shield-checkmark-outline" label="Assistance" />
          <Card>
            <TouchableOpacity style={s.supportRow} activeOpacity={0.7}>
              <View style={[s.supportIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#3B82F6" />
              </View>
              <View style={s.supportContent}>
                <Text style={s.supportLabel}>Un problème avec un document ?</Text>
                <Text style={s.supportSub}>Contactez notre support client</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
            <View style={s.supportDivider} />
            <TouchableOpacity style={s.supportRow} activeOpacity={0.7}>
              <View style={[s.supportIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#059669" />
              </View>
              <View style={s.supportContent}>
                <Text style={s.supportLabel}>Politique de remboursement</Text>
                <Text style={s.supportSub}>Vos droits en tant que client</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          </Card>
        </View>

      </ScrollView>

      {/* BottomSheet détail */}
      <TicketDetailSheet
        ticket={selectedTicket}
        isVisible={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FB' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111' },
  headerSub: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
  helpBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  section: { marginBottom: 20 },

  // Peppol banner
  peppolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14,
    padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: '#EDE9FE',
    ...Platform.select({
      ios: { shadowColor: '#7C3AED', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  peppolIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  peppolContent: { flex: 1 },
  peppolTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  peppolSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  // Support rows
  supportRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  supportIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  supportContent: { flex: 1 },
  supportLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  supportSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  supportDivider: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 64 },
});