// components/sheets/TicketDetailSheet.tsx — Client Detail Sheet
// Design system identique à MissionDetail (missions.tsx)
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';

// ============================================================================
// TYPES
// ============================================================================

interface TicketDetailSheetProps {
  ticket: any | null;
  isVisible: boolean;
  onClose: () => void;
}

// ============================================================================
// UTILS — identiques à missions.tsx
// ============================================================================

const formatEuros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING_PAYMENT: { label: 'Paiement',   color: '#7C3AED', bg: '#EDE9FE', icon: 'card-outline' },
  PUBLISHED:       { label: 'Publié',     color: '#B45309', bg: '#FEF3C7', icon: 'radio-outline' },
  ACCEPTED:        { label: 'Confirmé',   color: '#1D4ED8', bg: '#DBEAFE', icon: 'checkmark-circle-outline' },
  ONGOING:         { label: 'En cours',   color: '#15803D', bg: '#DCFCE7', icon: 'flash-outline' },
  DONE:            { label: 'Terminé',    color: '#374151', bg: '#F3F4F6', icon: 'checkmark-done-outline' },
  CANCELLED:       { label: 'Annulé',     color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

const getStatus = (s?: string) =>
  STATUS_CFG[s ?? ''] ?? { label: s ?? '—', color: '#6B7280', bg: '#F3F4F6', icon: 'ellipse-outline' };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const fmtDateLong = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

// ============================================================================
// AVATAR INITIALES — copie exacte de ClientAvatar dans missions.tsx
// ============================================================================

function ProviderAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[av.text, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFF', fontWeight: '800', letterSpacing: 0.5 },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TicketDetailSheet({ ticket, isVisible, onClose }: TicketDetailSheetProps) {
  const router = useRouter();
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} pressBehavior="close" />
    ), []
  );

  const openMap = () => {
    if (!ticket?.lat || !ticket?.lng) return;
    const url = Platform.select({
      ios: `maps://app?daddr=${ticket.lat},${ticket.lng}`,
      android: `google.navigation:q=${ticket.lat},${ticket.lng}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleInvoice = async () => {
    if (!ticket?.id) return;
    try {
      setInvoiceLoading(true);
      const res = await api.documents.getInvoice(String(ticket.id));
      const url = res?.url || res?.data?.url || res?.downloadUrl || res?.data?.downloadUrl;
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Facture', 'Le lien de téléchargement n\'est pas encore disponible.');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de récupérer la facture');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleRate = () => {
    if (!ticket?.id) return;
    onClose();
    router.push(`/request/${ticket.id}/rating`);
  };

  const handleReorder = () => {
    if (!ticket) return;
    onClose();
    router.push({
      pathname: '/request/NewRequestStepper',
      params: {
        categoryId: ticket.category?.id || ticket.categoryId || '',
        subcategoryId: ticket.subcategory?.id || ticket.subcategoryId || '',
        description: ticket.description || '',
        address: ticket.address || '',
      },
    });
  };

  if (!isVisible || !ticket) return null;

  const cfg = getStatus(ticket.status);
  const ref = String(ticket.id).slice(-6).toUpperCase();
  const hasCoords = !!(ticket.lat && ticket.lng);
  const address = ticket.address || '';
  const isDone = ticket.status === 'DONE';
  const isCancelled = ticket.status === 'CANCELLED';
  const providerName = ticket.provider?.name || 'Prestataire';

  return (
    <BottomSheet
      index={0}
      snapPoints={['92%']}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={sd.indicator}
    >
      <BottomSheetScrollView contentContainerStyle={sd.scroll}>

        {/* ── Handle ── */}
        <View style={sd.handle} />

        {/* ── Mini-Map pleine largeur (identique à MissionDetail) ── */}
        {hasCoords ? (
          <View style={sd.mapContainer}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={sd.map}
              initialRegion={{
                latitude: ticket.lat,
                longitude: ticket.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={{ latitude: ticket.lat, longitude: ticket.lng }}>
                <View style={sd.mapMarker}>
                  <Ionicons name="location" size={22} color="#FFF" />
                </View>
              </Marker>
            </MapView>
            <View style={sd.mapOverlay}>
              <View style={sd.mapAddressBadge}>
                <Ionicons name="location-outline" size={12} color="#6B7280" />
                <Text style={sd.mapAddressText} numberOfLines={1}>{address}</Text>
              </View>
            </View>
            <View style={[sd.mapStatusPill, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
              <Text style={[sd.mapStatusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
        ) : (
          <View style={sd.mapFallback}>
            <Ionicons name="map-outline" size={28} color="#D1D5DB" />
            <Text style={sd.mapFallbackText}>{address || 'Adresse non disponible'}</Text>
            <View style={[sd.statusPill, { backgroundColor: cfg.bg, marginTop: 8 }]}>
              <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
              <Text style={[sd.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
        )}

        <View style={sd.body}>

          {/* ── Titre + Réf ── */}
          <View style={sd.titleRow}>
            <View style={sd.titleBlock}>
              <Text style={sd.titleRef}>Réf. {ref}</Text>
              <Text style={sd.title}>{ticket.serviceType || ticket.title || 'Service'}</Text>
            </View>
          </View>

          {/* ── Urgent badge ── */}
          {!!ticket.urgent && (
            <View style={sd.urgentBadge}>
              <Ionicons name="alert-circle" size={15} color="#B91C1C" />
              <Text style={sd.urgentText}>Demande urgente</Text>
            </View>
          )}

          {/* ── Bloc Prix (focus client) ── */}
          {ticket.price != null && (
            <View style={sd.section}>
              <View style={sd.sectionLabelRow}>
                <Ionicons name="receipt-outline" size={13} color="#9CA3AF" />
                <Text style={sd.sectionLabel}>Montant payé</Text>
              </View>
              <View style={sd.priceRow}>
                <View style={sd.priceMain}>
                  <Text style={sd.priceAmount}>{formatEuros(ticket.price)}</Text>
                  {ticket.tax != null && (
                    <Text style={sd.priceTax}>dont TVA : {formatEuros(ticket.tax)}</Text>
                  )}
                </View>
                <View style={sd.priceMeta}>
                  {ticket.paymentMethod && (
                    <View style={sd.paymentPill}>
                      <Ionicons name="card-outline" size={12} color="#6B7280" />
                      <Text style={sd.paymentText}>{ticket.paymentMethod}</Text>
                    </View>
                  )}
                  {isDone && (
                    <TouchableOpacity
                      style={sd.invoiceLink}
                      onPress={handleInvoice}
                      disabled={invoiceLoading}
                      activeOpacity={0.8}
                    >
                      {invoiceLoading ? (
                        <ActivityIndicator size={12} color="#7C3AED" />
                      ) : (
                        <Ionicons name="download-outline" size={13} color="#7C3AED" />
                      )}
                      <Text style={sd.invoiceLinkText}>Voir la facture</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* ── Timeline ── */}
          {(ticket.createdAt || ticket.preferredTimeStart) && (
            <View style={sd.section}>
              <View style={sd.sectionLabelRow}>
                <Ionicons name="time-outline" size={13} color="#9CA3AF" />
                <Text style={sd.sectionLabel}>Chronologie</Text>
              </View>
              <View style={sd.timeline}>
                {ticket.createdAt && (
                  <View style={sd.timelineRow}>
                    <View style={sd.timelineDotDone} />
                    <View style={sd.timelineConnector} />
                    <View style={sd.timelineContent}>
                      <Text style={sd.timelineTitle}>Demande passée</Text>
                      <Text style={sd.timelineSub}>{fmtDate(ticket.createdAt)} · {fmtTime(ticket.createdAt)}</Text>
                    </View>
                  </View>
                )}
                {ticket.preferredTimeStart && (
                  <View style={sd.timelineRow}>
                    <View style={[sd.timelineDot, sd.timelineDotActive]} />
                    <View style={sd.timelineConnector} />
                    <View style={sd.timelineContent}>
                      <Text style={sd.timelineTitle}>Date souhaitée</Text>
                      <Text style={sd.timelineSub}>
                        {fmtDateLong(ticket.preferredTimeStart)} · {fmtTime(ticket.preferredTimeStart)}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={sd.timelineRow}>
                  <View style={[sd.timelineDot, isDone ? sd.timelineDotDone : sd.timelineDotPending]} />
                  <View style={[sd.timelineContent, { marginLeft: 0 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {isDone && <Ionicons name="checkmark-circle" size={14} color="#059669" />}
                      <Text style={[sd.timelineTitle, isDone && { color: '#059669' }]}>
                        {isDone ? 'Service terminé' : 'Prestation à venir'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── Détails service ── */}
          {(ticket.description || ticket.category || ticket.subcategory) && (
            <View style={sd.section}>
              <View style={sd.sectionLabelRow}>
                <Ionicons name="information-circle-outline" size={13} color="#9CA3AF" />
                <Text style={sd.sectionLabel}>Détails</Text>
              </View>
              {(ticket.category || ticket.subcategory) && (
                <View style={[sd.infoRow, { marginBottom: 10 }]}>
                  <View style={[sd.infoIcon, { backgroundColor: '#DBEAFE' }]}>
                    <Ionicons name="layers-outline" size={15} color="#1D4ED8" />
                  </View>
                  <View style={sd.infoContent}>
                    <Text style={sd.infoLabel}>CATÉGORIE</Text>
                    <Text style={sd.infoValue}>
                      {[ticket.category?.name, ticket.subcategory?.name].filter(Boolean).join(' › ')}
                    </Text>
                  </View>
                </View>
              )}
              {ticket.description && (
                <View style={sd.infoRow}>
                  <View style={[sd.infoIcon, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="document-text-outline" size={15} color="#16A34A" />
                  </View>
                  <View style={sd.infoContent}>
                    <Text style={sd.infoLabel}>DESCRIPTION</Text>
                    <Text style={sd.infoValue}>{ticket.description}</Text>
                  </View>
                </View>
              )}
              {address && (
                <View style={sd.infoRow}>
                  <View style={[sd.infoIcon, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="location-outline" size={15} color="#3B82F6" />
                  </View>
                  <View style={sd.infoContent}>
                    <Text style={sd.infoLabel}>ADRESSE</Text>
                    <Text style={sd.infoValue}>{address}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Prestataire ── */}
          {ticket.provider && (
            <View style={sd.section}>
              <View style={sd.sectionLabelRow}>
                <Ionicons name="person-outline" size={13} color="#9CA3AF" />
                <Text style={sd.sectionLabel}>Prestataire assigné</Text>
              </View>
              <View style={sd.clientCard}>
                <ProviderAvatar name={providerName} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={sd.clientCardName}>{providerName}</Text>
                  {ticket.provider.avgRating != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600' }}>
                        {Number(ticket.provider.avgRating).toFixed(1)} / 5
                      </Text>
                    </View>
                  )}
                  {ticket.provider.city && (
                    <Text style={sd.clientCardPhone}>{ticket.provider.city}</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {ticket.provider.phone && (
                    <TouchableOpacity
                      style={sd.callBtn}
                      onPress={() => Linking.openURL(`tel:${ticket.provider.phone}`)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[sd.callBtn, { backgroundColor: '#EDE9FE' }]}
                    onPress={() => Alert.alert('Messagerie', 'Fonctionnalité en développement')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#7C3AED" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ── Informations ── */}
          <View style={sd.section}>
            <View style={sd.sectionLabelRow}>
              <Ionicons name="document-outline" size={13} color="#9CA3AF" />
              <Text style={sd.sectionLabel}>Informations</Text>
            </View>
            <View style={sd.infoRow}>
              <View style={[sd.infoIcon, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="barcode-outline" size={15} color="#6B7280" />
              </View>
              <View style={sd.infoContent}>
                <Text style={sd.infoLabel}>RÉFÉRENCE</Text>
                <Text style={sd.infoValue}>#{ref}</Text>
              </View>
            </View>
            {ticket.createdAt && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="calendar-outline" size={15} color="#6B7280" />
                </View>
                <View style={sd.infoContent}>
                  <Text style={sd.infoLabel}>CRÉÉE LE</Text>
                  <Text style={sd.infoValue}>{fmtDateLong(ticket.createdAt)}</Text>
                </View>
              </View>
            )}
            {ticket.paymentMethod && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="card-outline" size={15} color="#6B7280" />
                </View>
                <View style={sd.infoContent}>
                  <Text style={sd.infoLabel}>PAIEMENT</Text>
                  <Text style={sd.infoValue}>{ticket.paymentMethod}</Text>
                </View>
              </View>
            )}
          </View>

          {/* ── Actions ── */}
          <View style={sd.actions}>
            {hasCoords && (
              <TouchableOpacity style={sd.navBtn} onPress={openMap} activeOpacity={0.85}>
                <Ionicons name="navigate" size={18} color="#FFF" />
                <Text style={sd.navBtnText}>Ouvrir dans Maps</Text>
              </TouchableOpacity>
            )}
            {isDone && (
              <TouchableOpacity
                style={sd.rateBtn}
                onPress={handleRate}
                activeOpacity={0.85}
              >
                <Ionicons name="star-outline" size={18} color="#F59E0B" />
                <Text style={sd.rateBtnText}>Évaluer le prestataire</Text>
              </TouchableOpacity>
            )}
            {isDone && (
              <TouchableOpacity
                style={sd.invoiceBtn}
                onPress={handleInvoice}
                disabled={invoiceLoading}
                activeOpacity={0.85}
              >
                {invoiceLoading ? (
                  <ActivityIndicator size={18} color="#7C3AED" />
                ) : (
                  <Ionicons name="receipt-outline" size={18} color="#7C3AED" />
                )}
                <Text style={sd.invoiceBtnText}>Facture Peppol</Text>
              </TouchableOpacity>
            )}
            {(isDone || isCancelled) && (
              <TouchableOpacity
                style={sd.reorderBtn}
                onPress={handleReorder}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={18} color="#059669" />
                <Text style={sd.reorderBtnText}>Refaire cette demande</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={sd.supportBtn}
              onPress={() => Alert.alert('Support', 'Fonctionnalité en développement')}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#DC2626" />
              <Text style={sd.supportBtnText}>Un problème avec ce document ?</Text>
            </TouchableOpacity>
          </View>

        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ============================================================================
// STYLES — copie exacte du système sd de missions.tsx
// ============================================================================

const sd = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  indicator: { backgroundColor: '#E5E7EB', width: 36, height: 4 },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },

  // ── Map (identique missions.tsx) ──
  mapContainer: {
    height: 180, marginHorizontal: 0, marginTop: 8,
    borderRadius: 0, overflow: 'hidden', position: 'relative',
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapMarker: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#172247', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 5 },
    }),
  },
  mapOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 30,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  mapAddressBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
  },
  mapAddressText: { fontSize: 12, color: '#374151', fontWeight: '600', maxWidth: 240 },
  mapStatusPill: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  mapStatusText: { fontSize: 11, fontWeight: '700' },
  mapFallback: {
    height: 100, backgroundColor: '#F3F4F6', marginHorizontal: 20, marginTop: 8,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  mapFallbackText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // ── Body ──
  body: { paddingHorizontal: 20, paddingTop: 16 },
  titleRow: { marginBottom: 16 },
  titleBlock: { flex: 1, gap: 4 },
  titleRef: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEE2E2', borderLeftWidth: 3, borderLeftColor: '#B91C1C',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 12,
  },
  urgentText: { fontSize: 13, fontWeight: '700', color: '#B91C1C' },

  // ── Sections (identique missions.tsx) ──
  section: { backgroundColor: '#F8F9FB', borderRadius: 16, padding: 14, marginBottom: 12 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Prix client ──
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  priceMain: { gap: 2 },
  priceAmount: { fontSize: 32, fontWeight: '900', color: '#111', letterSpacing: -1 },
  priceTax: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  priceMeta: { alignItems: 'flex-end', gap: 6 },
  paymentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  paymentText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  invoiceLink: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EDE9FE', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  invoiceLinkText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

  // ── Timeline (identique missions.tsx) ──
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3, marginRight: 12, flexShrink: 0 },
  timelineDotDone: { width: 12, height: 12, borderRadius: 6, marginTop: 3, marginRight: 12, flexShrink: 0, backgroundColor: '#059669' },
  timelineDotActive: { backgroundColor: '#172247' },
  timelineDotPending: { backgroundColor: '#D1D5DB', borderWidth: 2, borderColor: '#9CA3AF' },
  timelineConnector: { position: 'absolute', left: 5, top: 16, width: 2, height: 18, backgroundColor: '#E5E7EB' },
  timelineContent: { flex: 1, marginBottom: 16 },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: '#111' },
  timelineSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // ── Info rows (identique missions.tsx) ──
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 14, color: '#111', lineHeight: 20 },

  // ── Prestataire (identique missions.tsx — clientCard) ──
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientCardName: { fontSize: 15, fontWeight: '700', color: '#111' },
  clientCardPhone: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },

  // ── Actions (identique missions.tsx) ──
  actions: { marginTop: 8, gap: 10, marginBottom: 8 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#172247', borderRadius: 16, paddingVertical: 15,
  },
  navBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  rateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  rateBtnText: { fontSize: 15, fontWeight: '700', color: '#B45309' },
  invoiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EDE9FE', borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  invoiceBtnText: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  reorderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ECFDF5', borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  reorderBtnText: { fontSize: 15, fontWeight: '700', color: '#059669' },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: '#FECACA',
  },
  supportBtnText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});
