// components/sheets/TicketDetailSheet.tsx
// ─── Fiche Mission Premium — Palette Noir/Blanc/Gris, Zéro Alert ─────────────
// Design : "Facture élégante" — hiérarchie Statut → Prestataire → Prix → Actions

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Linking, TouchableOpacity,
  Platform, Pressable,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

// ─── Grayscale map style (cohérent avec MissionView) ─────────────────────────
const MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#f0f0f0' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi',     elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road',    elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'water',   elementType: 'geometry', stylers: [{ color: '#d0d0d0' }] },
];

// ============================================================================
// TYPES
// ============================================================================

interface TicketDetailSheetProps {
  ticket: any | null;
  isVisible: boolean;
  onClose: () => void;
  onNavigateToOngoing?: (requestId: string) => void; // CTA "Rejoindre la mission"
}

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// Palette 100% monochrome — seul le vert succès (#059669) est autorisé comme couleur
const STATUS_CFG: Record<string, { label: string; icon: string; done?: boolean; active?: boolean }> = {
  PENDING_PAYMENT: { label: 'Paiement en attente', icon: 'card-outline' },
  PUBLISHED:       { label: 'Recherche en cours',  icon: 'radio-outline',            active: true },
  ACCEPTED:        { label: 'Confirmé',             icon: 'checkmark-circle-outline', active: true },
  ONGOING:         { label: 'En cours',             icon: 'flash-outline',            active: true },
  DONE:            { label: 'Terminé',              icon: 'checkmark-done-outline',   done: true },
  CANCELLED:       { label: 'Annulé',               icon: 'close-circle-outline' },
};

const getStatus = (s?: string) =>
  STATUS_CFG[s ?? ''] ?? { label: s ?? '—', icon: 'ellipse-outline' };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const fmtDateLong = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

// ============================================================================
// SOUS-COMPOSANTS
// ============================================================================

// ─── Avatar prestataire (initiales) ──────────────────────────────────────────
function ProviderAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.text, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' },
  text:   { color: '#FFF', fontWeight: '800', letterSpacing: 0.5 },
});

// ─── Étoiles de notation ──────────────────────────────────────────────────────
function StarRow({ rating, onRate }: { rating: number; onRate?: (r: number) => void }) {
  return (
    <View style={sr.row}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity
          key={i}
          onPress={() => onRate?.(i)}
          activeOpacity={onRate ? 0.7 : 1}
          disabled={!onRate}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons
            name={i <= Math.round(rating) ? 'star' : 'star-outline'}
            size={22}
            color={i <= Math.round(rating) ? '#1A1A1A' : '#D0D0D0'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
});

// ─── Divider ultra-fin ────────────────────────────────────────────────────────
function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: '#EBEBEB', marginVertical: 14 }} />;
}

// ─── Ligne d'info (icône + label + valeur) ───────────────────────────────────
function InfoRow({ icon, label, value, iconBg = '#F5F5F5' }: {
  icon: string; label: string; value: string; iconBg?: string;
}) {
  return (
    <View style={ir.row}>
      <View style={[ir.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={15} color="#555" />
      </View>
      <View style={ir.content}>
        <Text style={ir.label}>{label}</Text>
        <Text style={ir.value}>{value}</Text>
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content:  { flex: 1 },
  label:    { fontSize: 10, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  value:    { fontSize: 14, fontWeight: '600', color: '#1A1A1A', lineHeight: 20 },
});

// ─── Prix décomposé ───────────────────────────────────────────────────────────
function PriceBreakdown({ price, tax }: { price: number; tax?: number }) {
  // Si pas de TVA connue, on affiche juste le total
  const serviceFee = tax != null ? price - tax : null;

  return (
    <View style={prb.wrap}>
      {serviceFee != null && tax != null && (
        <>
          <View style={prb.row}>
            <Text style={prb.lineLabel}>Service</Text>
            <Text style={prb.lineValue}>{formatEuros(serviceFee)}</Text>
          </View>
          <View style={prb.row}>
            <Text style={prb.lineLabel}>TVA</Text>
            <Text style={prb.lineValue}>{formatEuros(tax)}</Text>
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: '#E0E0E0', marginVertical: 10 }} />
        </>
      )}
      <View style={prb.totalRow}>
        <Text style={prb.totalLabel}>Total payé</Text>
        <Text style={prb.totalValue}>{formatEuros(price)}</Text>
      </View>
    </View>
  );
}
const prb = StyleSheet.create({
  wrap:       { backgroundColor: '#F8F8F8', borderRadius: 16, padding: 16 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  lineLabel:  { fontSize: 14, color: '#888', fontWeight: '500' },
  lineValue:  { fontSize: 14, color: '#555', fontWeight: '600' },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  totalValue: { fontSize: 28, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.8 },
});

// ─── Bouton d'action principal ────────────────────────────────────────────────
function ActionBtn({
  label, icon, onPress, variant = 'primary',
}: {
  label: string; icon: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger';
}) {
  const style =
    variant === 'primary' ? ab.primary :
    variant === 'danger'  ? ab.danger  : ab.ghost;
  const textStyle =
    variant === 'primary' ? ab.primaryText :
    variant === 'danger'  ? ab.dangerText  : ab.ghostText;
  const iconColor =
    variant === 'primary' ? '#FFF' :
    variant === 'danger'  ? '#FF3B30' : '#888';

  return (
    <TouchableOpacity style={[ab.base, style]} onPress={onPress} activeOpacity={0.78}>
      <Ionicons name={icon as any} size={18} color={iconColor} />
      <Text style={[ab.baseText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  base:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16 },
  baseText:    { fontSize: 15, fontWeight: '700' },
  primary:     { backgroundColor: '#1A1A1A' },
  primaryText: { color: '#FFF' },
  ghost:       { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#E0E0E0' },
  ghostText:   { color: '#888' },
  danger:      { backgroundColor: 'rgba(255,59,48,0.06)', borderWidth: 1.5, borderColor: 'rgba(255,59,48,0.2)' },
  dangerText:  { color: '#FF3B30' },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TicketDetailSheet({ ticket, isVisible, onClose, onNavigateToOngoing }: TicketDetailSheetProps) {
  const [pendingRating, setPendingRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.35}
        pressBehavior="close"
      />
    ), []
  );

  const openMap = async () => {
    if (!ticket?.lat || !ticket?.lng) return;
    const lat = ticket.lat;
    const lng = ticket.lng;

    if (Platform.OS === 'ios') {
      const googleUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      const appleUrl  = `maps://?daddr=${lat},${lng}`;
      const webUrl    = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      const canGoogle = await Linking.canOpenURL(googleUrl);
      if (canGoogle) { Linking.openURL(googleUrl); return; }
      const canApple = await Linking.canOpenURL(appleUrl);
      Linking.openURL(canApple ? appleUrl : webUrl);
    } else {
      const navUrl = `google.navigation:q=${lat},${lng}&mode=d`;
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      const canOpen = await Linking.canOpenURL(navUrl);
      Linking.openURL(canOpen ? navUrl : webUrl);
    }
  };

  const handleRate = async (rating: number) => {
    setPendingRating(rating);
    // TODO: await api.post(`/requests/${ticket.id}/rating`, { rating })
    console.log(`[TicketDetailSheet] Rating soumis: ${rating}/5 pour mission #${ticket?.id}`);
    setTimeout(() => setRatingSubmitted(true), 400);
  };

  const handleInvoice = () => {
    // TODO: Linking.openURL(ticket.invoiceUrl) ou téléchargement PDF
    console.log('[TicketDetailSheet] Téléchargement facture:', ticket?.id);
  };

  const handleReorder = () => {
    // TODO: router.push({ pathname: '/request/new', params: { selectedCategory: ticket?.category?.slug } })
    console.log('[TicketDetailSheet] Reorder:', ticket?.id);
  };

  const handleSupport = () => {
    // TODO: router.push('/support', { params: { requestId: ticket?.id } })
    console.log('[TicketDetailSheet] Support pour:', ticket?.id);
  };

  const handleContact = () => {
    if (ticket?.provider?.phone) {
      Linking.openURL(`tel:${ticket.provider.phone}`);
    }
  };

  if (!isVisible || !ticket) return null;

  const cfg          = getStatus(ticket.status);
  const ref          = String(ticket.id).slice(-6).toUpperCase();
  const hasCoords    = !!(ticket.lat && ticket.lng);
  const address      = ticket.address || '';
  const isDone       = ticket.status === 'DONE';
  const isOngoing    = ticket.status === 'ONGOING' || ticket.status === 'ACCEPTED';
  const isCancelled  = ticket.status === 'CANCELLED';
  const providerName = ticket.provider?.name || 'Prestataire';
  const hasRating    = ticket.clientRating != null;
  const showRatingBlock = isDone && !hasRating && !ratingSubmitted;

  // Badge statut : monochrome — fond noir si actif, fond gris si terminé/annulé
  const badgeBg    = cfg.done ? '#F0F0F0' : cfg.active ? '#1A1A1A' : '#F0F0F0';
  const badgeColor = cfg.done ? '#1A1A1A' : cfg.active ? '#FFF'    : '#888';

  return (
    <BottomSheet
      index={0}
      snapPoints={['92%']}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={sd.indicator}
      backgroundStyle={sd.sheetBg}
    >
      <BottomSheetScrollView
        contentContainerStyle={sd.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header : Titre + Badge statut ───────────────────────────────── */}
        <View style={sd.header}>
          <View style={sd.headerLeft}>
            <Text style={sd.headerRef}>Réf. #{ref}</Text>
            <Text style={sd.headerTitle} numberOfLines={2}>
              {ticket.serviceType || ticket.title || 'Service'}
            </Text>
          </View>

          <View style={{ gap: 6, alignItems: 'flex-end' }}>
            {/* Statut badge */}
            <View style={[sd.statusBadge, { backgroundColor: badgeBg }]}>
              <Ionicons name={cfg.icon as any} size={11} color={badgeColor} />
              <Text style={[sd.statusBadgeText, { color: badgeColor }]}>{cfg.label}</Text>
            </View>
            {/* Aide */}
            <TouchableOpacity onPress={handleSupport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="help-circle-outline" size={22} color="#ADADAD" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Badge urgent */}
        {!!ticket.urgent && (
          <View style={sd.urgentBadge}>
            <Ionicons name="alert-circle-outline" size={14} color="#1A1A1A" />
            <Text style={sd.urgentText}>Demande urgente</Text>
          </View>
        )}

        {/* ── Mini-carte Silver (statique) ────────────────────────────────── */}
        {hasCoords ? (
          <View style={sd.mapContainer}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={sd.map}
              customMapStyle={MAP_STYLE}
              initialRegion={{
                latitude:      ticket.lat,
                longitude:     ticket.lng,
                latitudeDelta:  0.012,
                longitudeDelta: 0.012,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              showsPointsOfInterest={false}
              showsBuildings={false}
            >
              <Marker coordinate={{ latitude: ticket.lat, longitude: ticket.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={sd.mapMarkerOuter}>
                  <View style={sd.mapMarkerInner} />
                </View>
              </Marker>
            </MapView>

            {/* Adresse badge en bas */}
            <View style={sd.mapAddrOverlay}>
              <View style={sd.mapAddrBadge}>
                <Ionicons name="location-outline" size={11} color="#555" />
                <Text style={sd.mapAddrText} numberOfLines={1}>{address}</Text>
              </View>
            </View>
          </View>
        ) : address ? (
          <View style={sd.noMapAddr}>
            <Ionicons name="location-outline" size={16} color="#ADADAD" />
            <Text style={sd.noMapAddrText} numberOfLines={2}>{address}</Text>
          </View>
        ) : null}

        <View style={sd.body}>

          {/* ══ 1. PRESTATAIRE (facteur de confiance n°1) ══════════════════ */}
          {ticket.provider && (
            <>
              <View style={sd.providerRow}>
                <ProviderAvatar name={providerName} size={52} />

                <View style={sd.providerInfo}>
                  <Text style={sd.providerName}>{providerName}</Text>
                  {ticket.provider.avgRating != null && (
                    <View style={sd.providerRatingRow}>
                      <Ionicons name="star" size={12} color="#1A1A1A" />
                      <Text style={sd.providerRatingText}>
                        {Number(ticket.provider.avgRating).toFixed(1)}
                      </Text>
                      <Text style={sd.providerJobsText}>
                        · {ticket.provider.jobsCompleted || 0} missions
                      </Text>
                    </View>
                  )}
                  {ticket.provider.city && (
                    <Text style={sd.providerCity}>{ticket.provider.city}</Text>
                  )}
                </View>

                {/* Actions communication */}
                <View style={sd.providerActions}>
                  {ticket.provider.phone && (
                    <TouchableOpacity style={sd.comBtn} onPress={handleContact} activeOpacity={0.75}>
                      <Ionicons name="call" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Divider />
            </>
          )}

          {/* ══ 2. PRIX DÉCOMPOSÉ ══════════════════════════════════════════ */}
          {ticket.price != null && (
            <>
              <View style={sd.sectionHeader}>
                <Ionicons name="receipt-outline" size={13} color="#ADADAD" />
                <Text style={sd.sectionLabel}>Détail du paiement</Text>
              </View>

              <PriceBreakdown price={ticket.price} tax={ticket.tax} />

              {/* Méthode de paiement + lien facture */}
              <View style={sd.paymentMeta}>
                {ticket.paymentMethod && (
                  <View style={sd.paymentPill}>
                    <Ionicons name="card-outline" size={12} color="#888" />
                    <Text style={sd.paymentPillText}>{ticket.paymentMethod}</Text>
                  </View>
                )}
                {isDone && (
                  <TouchableOpacity style={sd.invoicePill} onPress={handleInvoice} activeOpacity={0.75}>
                    <Ionicons name="download-outline" size={12} color="#1A1A1A" />
                    <Text style={sd.invoicePillText}>Télécharger la facture</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Divider />
            </>
          )}

          {/* ══ 3. NOTATION (si mission terminée et non notée) ════════════ */}
          {showRatingBlock && (
            <>
              <View style={sd.ratingBlock}>
                <Text style={sd.ratingTitle}>Comment s'est passée la mission ?</Text>
                <Text style={sd.ratingSubtitle}>Votre avis aide les autres utilisateurs.</Text>
                <View style={sd.ratingStars}>
                  <StarRow rating={pendingRating} onRate={handleRate} />
                </View>
                {pendingRating > 0 && (
                  <Text style={sd.ratingPending}>
                    {pendingRating === 5 ? 'Excellent !' :
                     pendingRating >= 4 ? 'Très bien' :
                     pendingRating >= 3 ? 'Correct' :
                     pendingRating >= 2 ? 'Peut mieux faire' : 'Décevant'}
                  </Text>
                )}
              </View>
              <Divider />
            </>
          )}

          {ratingSubmitted && (
            <>
              <View style={sd.ratingDone}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={sd.ratingDoneText}>Merci pour votre évaluation !</Text>
              </View>
              <Divider />
            </>
          )}

          {hasRating && (
            <>
              <View style={sd.sectionHeader}>
                <Ionicons name="star-outline" size={13} color="#ADADAD" />
                <Text style={sd.sectionLabel}>Votre évaluation</Text>
              </View>
              <StarRow rating={ticket.clientRating} />
              <Divider />
            </>
          )}

          {/* ══ 4. CHRONOLOGIE ════════════════════════════════════════════ */}
          {(ticket.createdAt || ticket.preferredTimeStart) && (
            <>
              <View style={sd.sectionHeader}>
                <Ionicons name="time-outline" size={13} color="#ADADAD" />
                <Text style={sd.sectionLabel}>Chronologie</Text>
              </View>

              {ticket.createdAt && (
                <InfoRow
                  icon="ellipse"
                  label="Demande créée"
                  value={`${fmtDate(ticket.createdAt)} · ${fmtTime(ticket.createdAt)}`}
                />
              )}
              {ticket.preferredTimeStart && (
                <InfoRow
                  icon="calendar-outline"
                  label="Date souhaitée"
                  value={`${fmtDateLong(ticket.preferredTimeStart)} · ${fmtTime(ticket.preferredTimeStart)}`}
                />
              )}
              {isDone && (
                <InfoRow icon="checkmark-circle-outline" label="Terminée" value="Mission complétée" iconBg="#ECFDF5" />
              )}

              <Divider />
            </>
          )}

          {/* ══ 5. DÉTAILS SERVICE ════════════════════════════════════════ */}
          {(ticket.description || ticket.category || ticket.subcategory || address) && (
            <>
              <View style={sd.sectionHeader}>
                <Ionicons name="document-text-outline" size={13} color="#ADADAD" />
                <Text style={sd.sectionLabel}>Détails</Text>
              </View>

              {(ticket.category || ticket.subcategory) && (
                <InfoRow
                  icon="layers-outline"
                  label="Catégorie"
                  value={[ticket.category?.name, ticket.subcategory?.name].filter(Boolean).join(' › ')}
                />
              )}
              {ticket.description && (
                <InfoRow icon="chatbox-outline" label="Description" value={ticket.description} />
              )}
              {address && (
                <InfoRow icon="location-outline" label="Adresse" value={address} />
              )}
              {ticket.urgent && (
                <InfoRow icon="flash-outline" label="Priorité" value="Urgente" />
              )}
              {ticket.paymentMethod && (
                <InfoRow icon="card-outline" label="Paiement" value={ticket.paymentMethod} />
              )}

              <Divider />
            </>
          )}

          {/* ══ 6. RÉFÉRENCE ═════════════════════════════════════════════ */}
          <View style={sd.sectionHeader}>
            <Ionicons name="information-circle-outline" size={13} color="#ADADAD" />
            <Text style={sd.sectionLabel}>Informations</Text>
          </View>
          <InfoRow icon="barcode-outline" label="Référence" value={`#${ref}`} />
          {ticket.createdAt && (
            <InfoRow icon="calendar-outline" label="Créée le" value={fmtDateLong(ticket.createdAt)} />
          )}

          {/* ══ 7. ACTIONS CONTEXTUELLES ══════════════════════════════════ */}
          <View style={sd.actions}>

            {/* En cours / Confirmé → Rejoindre l'ongoing + Contacter + Annuler */}
            {isOngoing && (
              <>
                {onNavigateToOngoing && (
                  <ActionBtn
                    label={ticket.status === 'ONGOING' ? 'Suivre la mission en cours' : 'Voir le prestataire en route'}
                    icon={ticket.status === 'ONGOING' ? 'navigate-outline' : 'locate-outline'}
                    onPress={() => {
                      onClose();
                      onNavigateToOngoing(String(ticket.id));
                    }}
                    variant="primary"
                  />
                )}
                {ticket.provider?.phone && (
                  <ActionBtn
                    label="Contacter le prestataire"
                    icon="call-outline"
                    onPress={handleContact}
                    variant="ghost"
                  />
                )}
                <TouchableOpacity style={sd.cancelLink} onPress={onClose} activeOpacity={0.6}>
                  <Text style={sd.cancelLinkText}>Annuler la mission</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Terminé → Facture + Recommander */}
            {isDone && (
              <>
                <ActionBtn
                  label="Télécharger la facture"
                  icon="receipt-outline"
                  onPress={handleInvoice}
                  variant="primary"
                />
                <ActionBtn
                  label="Commander à nouveau"
                  icon="refresh-outline"
                  onPress={handleReorder}
                  variant="ghost"
                />
              </>
            )}

            {/* Ouvrir dans Maps (toujours si coordonnées) */}
            {hasCoords && (
              <ActionBtn
                label="Ouvrir dans Maps"
                icon="navigate-outline"
                onPress={openMap}
                variant="ghost"
              />
            )}

            {/* Support — toujours disponible */}
            <ActionBtn
              label="Un problème avec cette mission ?"
              icon="help-circle-outline"
              onPress={handleSupport}
              variant="danger"
            />
          </View>

        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ============================================================================
// STYLES — Palette 100% monochrome (Blanc / #F5F5F5 / #1A1A1A)
// ============================================================================

const sd = StyleSheet.create({
  sheetBg:   { backgroundColor: '#FFF' },
  scroll:    { paddingBottom: 48 },
  indicator: { backgroundColor: '#E0E0E0', width: 36, height: 4 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerLeft:  { flex: 1, paddingRight: 12 },
  headerRef:   { fontSize: 11, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.4, lineHeight: 28 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#F5F5F5', borderLeftWidth: 3, borderLeftColor: '#1A1A1A',
    marginHorizontal: 22, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  urgentText: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },

  // ── Carte ────────────────────────────────────────────────────────────────────
  mapContainer: {
    height: 165,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapMarkerOuter: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(26,26,26,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  mapMarkerInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#1A1A1A',
    borderWidth: 2.5, borderColor: '#FFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 5 },
    }),
  },
  mapAddrOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingBottom: 10, paddingTop: 28,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  mapAddrBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
  },
  mapAddrText: { fontSize: 12, color: '#1A1A1A', fontWeight: '600', maxWidth: 260 },

  noMapAddr: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 22, marginBottom: 16,
    backgroundColor: '#F5F5F5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  noMapAddrText: { fontSize: 13, color: '#555', fontWeight: '500', flex: 1 },

  // ── Body ─────────────────────────────────────────────────────────────────────
  body: { paddingHorizontal: 22 },

  // ── Prestataire ───────────────────────────────────────────────────────────────
  providerRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  providerInfo:      { flex: 1 },
  providerName:      { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  providerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  providerRatingText:{ fontSize: 13, fontWeight: '800', color: '#1A1A1A' },
  providerJobsText:  { fontSize: 13, color: '#ADADAD', fontWeight: '500' },
  providerCity:      { fontSize: 12, color: '#ADADAD', fontWeight: '500' },
  providerActions:   { gap: 8 },
  comBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 5 },
    }),
  },

  // ── Prix ─────────────────────────────────────────────────────────────────────
  paymentMeta:     { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  paymentPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F5F5F5', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  paymentPillText: { fontSize: 12, color: '#888', fontWeight: '600' },
  invoicePill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F0F0', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#E0E0E0' },
  invoicePillText: { fontSize: 12, color: '#1A1A1A', fontWeight: '700' },

  // ── Rating ────────────────────────────────────────────────────────────────────
  ratingBlock: {
    backgroundColor: '#F8F8F8', borderRadius: 18,
    padding: 18, marginBottom: 4, alignItems: 'center',
  },
  ratingTitle:    { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 4, textAlign: 'center' },
  ratingSubtitle: { fontSize: 13, color: '#ADADAD', marginBottom: 14, textAlign: 'center' },
  ratingStars:    { marginBottom: 10 },
  ratingPending:  { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  ratingDone:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  ratingDoneText: { fontSize: 14, fontWeight: '700', color: '#059669' },

  // ── Section header ────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.7 },

  // ── Actions ───────────────────────────────────────────────────────────────────
  actions:    { marginTop: 4, gap: 10 },
  cancelLink: { alignItems: 'center', paddingVertical: 10 },
  cancelLinkText: { fontSize: 14, fontWeight: '600', color: '#ADADAD' },
});