// components/sheets/TicketDetailSheet.tsx
// ─── Fiche Mission Premium — Dark mode support via useAppTheme ─────────────
// Design : "Facture élégante" — hiérarchie Statut → Prestataire → Prix → Actions

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Linking, TouchableOpacity,
  Platform, Pressable, Alert, Dimensions,
} from 'react-native';
import { api } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useCall } from '@/lib/webrtc/CallContext';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { formatEUR as formatEuros } from '@/lib/format';

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

const STATUS_CFG: Record<string, { label: string; icon: string; done?: boolean; active?: boolean }> = {
  PENDING_PAYMENT: { label: 'Paiement en attente', icon: 'credit-card' },
  PUBLISHED:       { label: 'Recherche en cours',  icon: 'radio',              active: true },
  ACCEPTED:        { label: 'Confirmé',             icon: 'check-circle',      active: true },
  ONGOING:         { label: 'En cours',             icon: 'zap',               active: true },
  DONE:            { label: 'Terminé',              icon: 'check-circle',      done: true },
  CANCELLED:       { label: 'Annulé',               icon: 'x-circle' },
};

const getStatus = (s?: string) =>
  STATUS_CFG[s ?? ''] ?? { label: s ?? '—', icon: 'circle' };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const fmtDateLong = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

// ============================================================================
// SOUS-COMPOSANTS (theme-aware)
// ============================================================================

// ─── Avatar prestataire (initiales) ──────────────────────────────────────────
function ProviderAvatar({ name, size = 48, bgColor, textColor }: { name: string; size?: number; bgColor: string; textColor: string }) {
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}>
      <Text style={[av.text, { fontSize: size * 0.34, color: textColor, fontFamily: FONTS.sansMedium }]}>{initials}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text:   { letterSpacing: 0.5 },
});

// ─── Étoiles de notation ──────────────────────────────────────────────────────
function StarRow({ rating, onRate, starColor, emptyColor }: { rating: number; onRate?: (r: number) => void; starColor: string; emptyColor: string }) {
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
          <Feather
            name="star"
            size={22}
            color={i <= Math.round(rating) ? starColor : emptyColor}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TicketDetailSheet({ ticket, isVisible, onClose, onNavigateToOngoing }: TicketDetailSheetProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { initiateCall } = useCall();
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 70 : 54;
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
    if (!ticket?.provider?.id) return;
    setPendingRating(rating);
    try {
      await api.post('/ratings', {
        requestId: Number(ticket.id),
        providerId: ticket.provider.id,
        rating,
      });
      setTimeout(() => setRatingSubmitted(true), 400);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de soumettre l\'évaluation.');
      setPendingRating(0);
    }
  };

  const handleInvoice = async () => {
    try {
      const result = await api.documents.list();
      const invoices: any[] = result?.data?.invoices || result?.invoices || [];
      const invoice = invoices.find(
        (inv: any) => inv.requestId === ticket.id || inv.requestId === Number(ticket.id)
      );
      if (!invoice) {
        Alert.alert('Facture', 'Aucune facture disponible pour cette mission.');
        return;
      }
      const fileUrl: string | undefined = invoice.file?.url;
      if (fileUrl) {
        const base = (process.env.EXPO_PUBLIC_API_URL || '').replace('/api', '');
        const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${base}${fileUrl}`;
        await Linking.openURL(fullUrl);
      } else {
        Alert.alert('Facture', 'Le PDF n\'est pas encore disponible.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la facture.');
    }
  };

  const handleReorder = () => {
    onClose();
    const categorySlug = ticket?.category?.slug || ticket?.category?.name || '';
    router.push({
      pathname: '/request/NewRequestStepper',
      params: { selectedCategory: categorySlug },
    });
  };

  const handleSupport = () => {
    const ref = String(ticket?.id || '').slice(-6).toUpperCase();
    const subject = encodeURIComponent(`Problème avec la mission #${ref}`);
    const body = encodeURIComponent(`Bonjour,\n\nJ'ai un problème avec ma mission référence #${ref}.\n\nDétails : `);
    Linking.openURL(`mailto:support@fixed.app?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Support', 'Contactez-nous à support@fixed.app');
    });
  };

  const handleContact = () => {
    if (ticket?.provider?.userId) {
      onClose();
      initiateCall({
        targetUserId: ticket.provider.userId,
        targetName: ticket.provider.name || 'Prestataire',
        requestId: String(ticket.id),
      });
    } else if (ticket?.provider?.phone) {
      Linking.openURL(`tel:${ticket.provider.phone}`);
    }
  };

  const handleMessage = () => {
    if (!ticket?.provider?.userId) return;
    onClose();
    router.push({
      pathname: '/messages/[userId]',
      params: {
        userId: ticket.provider.userId,
        name: ticket.provider.name || 'Prestataire',
        requestId: String(ticket.id),
      },
    });
  };

  if (!isVisible || !ticket) return null;

  const cfg          = getStatus(ticket.status);
  const ref          = String(ticket.id).slice(-6).toUpperCase();
  const hasCoords    = !!(ticket.lat && ticket.lng);
  const address      = ticket.address || '';
  const isDone       = ticket.status === 'DONE';
  const isOngoing    = ticket.status === 'ONGOING' || ticket.status === 'ACCEPTED';
  const providerName = ticket.provider?.name || 'Prestataire';
  const hasRating    = ticket.clientRating != null;
  const showRatingBlock = isDone && !hasRating && !ratingSubmitted;

  // Badge statut : theme-aware
  const badgeBg    = cfg.done ? theme.surfaceAlt : cfg.active ? theme.accent : theme.surfaceAlt;
  const badgeColor = cfg.done ? theme.text : cfg.active ? theme.accentText : theme.textMuted;

  // ─── Divider component ──
  const DividerLine = () => (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.borderLight, marginVertical: 14 }} />
  );

  // ─── InfoRow component ──
  const InfoRow = ({ icon, label, value, iconBg }: {
    icon: string; label: string; value: string; iconBg?: string;
  }) => (
    <View style={sd.infoRow}>
      <View style={[sd.infoIconWrap, { backgroundColor: iconBg || theme.surfaceAlt }]}>
        <Feather name={icon as any} size={15} color={theme.textSub} />
      </View>
      <View style={sd.infoContent}>
        <Text style={[sd.infoLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{label}</Text>
        <Text style={[sd.infoValue, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{value}</Text>
      </View>
    </View>
  );

  // ─── PriceBreakdown component ──
  const PriceBreakdown = ({ price, tax }: { price: number; tax?: number }) => {
    const serviceFee = tax != null ? price - tax : null;
    return (
      <View style={[sd.prbWrap, { backgroundColor: theme.surfaceAlt }]}>
        {serviceFee != null && tax != null && (
          <>
            <View style={sd.prbRow}>
              <Text style={[sd.prbLineLabel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Service</Text>
              <Text style={[sd.prbLineValue, { color: theme.textSub, fontFamily: FONTS.mono }]}>{formatEuros(serviceFee)}</Text>
            </View>
            <View style={sd.prbRow}>
              <Text style={[sd.prbLineLabel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>TVA</Text>
              <Text style={[sd.prbLineValue, { color: theme.textSub, fontFamily: FONTS.mono }]}>{formatEuros(tax)}</Text>
            </View>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.borderLight, marginVertical: 10 }} />
          </>
        )}
        <View style={sd.prbTotalRow}>
          <Text style={[sd.prbTotalLabel, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Total payé</Text>
          <Text style={[sd.prbTotalValue, { color: theme.text, fontFamily: FONTS.bebas }]}>{formatEuros(price)}</Text>
        </View>
      </View>
    );
  };

  // ─── ActionBtn component ──
  const ActionBtn = ({
    label, icon, onPress, variant = 'primary',
  }: {
    label: string; icon: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger';
  }) => {
    const btnStyle =
      variant === 'primary' ? { backgroundColor: theme.accent } :
      variant === 'danger'  ? { backgroundColor: theme.isDark ? 'rgba(239,68,68,0.12)' : 'rgba(255,59,48,0.06)', borderWidth: 1.5, borderColor: theme.isDark ? 'rgba(239,68,68,0.3)' : 'rgba(255,59,48,0.2)' } :
      { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.borderLight };
    const textStyle =
      variant === 'primary' ? { color: theme.accentText } :
      variant === 'danger'  ? { color: COLORS.red } :
      { color: theme.textMuted };
    const iconColor =
      variant === 'primary' ? theme.accentText :
      variant === 'danger'  ? COLORS.red : theme.textMuted;

    return (
      <TouchableOpacity style={[sd.abBase, btnStyle]} onPress={onPress} activeOpacity={0.78}>
        <Feather name={icon as any} size={18} color={iconColor} />
        <Text style={[sd.abBaseText, textStyle, { fontFamily: FONTS.sansMedium }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={[sd.indicator, { backgroundColor: theme.textDisabled }]}
      backgroundStyle={{ backgroundColor: theme.cardBg }}
      maxDynamicContentSize={Dimensions.get('window').height * 0.9}
    >
      <BottomSheetScrollView
        contentContainerStyle={[sd.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header : Titre + Badge statut ───────────────────────────────── */}
        <View style={sd.header}>
          <View style={sd.headerLeft}>
            <Text style={[sd.headerRef, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Réf. #{ref}</Text>
            <Text style={[sd.headerTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={2}>
              {ticket.serviceType || ticket.title || 'Service'}
            </Text>
          </View>

          <View style={{ gap: 6, alignItems: 'flex-end' }}>
            {/* Statut badge */}
            <View style={[sd.statusBadge, { backgroundColor: badgeBg }]}>
              <Feather name={cfg.icon as any} size={11} color={badgeColor} />
              <Text style={[sd.statusBadgeText, { color: badgeColor, fontFamily: FONTS.sansMedium }]}>{cfg.label}</Text>
            </View>
            {/* Aide */}
            <TouchableOpacity onPress={handleSupport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="help-circle" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Badge urgent */}
        {!!ticket.urgent && (
          <View style={[sd.urgentBadge, { backgroundColor: theme.surfaceAlt, borderLeftColor: theme.text }]}>
            <Feather name="alert-circle" size={14} color={theme.text} />
            <Text style={[sd.urgentText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Demande urgente</Text>
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
                  <View style={[sd.mapMarkerInner, { backgroundColor: theme.text, borderColor: theme.cardBg }]} />
                </View>
              </Marker>
            </MapView>

            {/* Adresse badge en bas */}
            <View style={sd.mapAddrOverlay}>
              <View style={[sd.mapAddrBadge, { backgroundColor: theme.isDark ? 'rgba(30,30,30,0.94)' : 'rgba(255,255,255,0.94)' }]}>
                <Feather name="map-pin" size={11} color={theme.textSub} />
                <Text style={[sd.mapAddrText, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>{address}</Text>
              </View>
            </View>
          </View>
        ) : address ? (
          <View style={[sd.noMapAddr, { backgroundColor: theme.surfaceAlt }]}>
            <Feather name="map-pin" size={16} color={theme.textMuted} />
            <Text style={[sd.noMapAddrText, { color: theme.textSub, fontFamily: FONTS.sans }]} numberOfLines={2}>{address}</Text>
          </View>
        ) : null}

        <View style={sd.body}>

          {/* 1. PRESTATAIRE */}
          {ticket.provider && (
            <>
              <View style={sd.providerRow}>
                <ProviderAvatar name={providerName} size={52} bgColor={theme.accent} textColor={theme.accentText} />

                <View style={sd.providerInfo}>
                  <Text style={[sd.providerName, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{providerName}</Text>
                  {ticket.provider.avgRating != null && (
                    <View style={sd.providerRatingRow}>
                      <Feather name="star" size={12} color={theme.text} />
                      <Text style={[sd.providerRatingText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                        {Number(ticket.provider.avgRating).toFixed(1)}
                      </Text>
                      <Text style={[sd.providerJobsText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                        · {ticket.provider.jobsCompleted || 0} missions
                      </Text>
                    </View>
                  )}
                  {ticket.provider.city && (
                    <Text style={[sd.providerCity, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{ticket.provider.city}</Text>
                  )}
                </View>

                {/* Actions communication */}
                <View style={sd.providerActions}>
                  {ticket.provider.userId && (
                    <TouchableOpacity style={[sd.comBtn, { backgroundColor: theme.accent }]} onPress={handleMessage} activeOpacity={0.75}>
                      <Feather name="message-circle" size={16} color={theme.accentText} />
                    </TouchableOpacity>
                  )}
                  {ticket.provider.phone && (
                    <TouchableOpacity style={[sd.comBtn, { backgroundColor: theme.accent }]} onPress={handleContact} activeOpacity={0.75}>
                      <Feather name="phone" size={16} color={theme.accentText} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <DividerLine />
            </>
          )}

          {/* 2. PRIX DECOMPOSE */}
          {ticket.price != null && (
            <>
              <View style={sd.sectionHeader}>
                <Feather name="file-text" size={13} color={theme.textMuted} />
                <Text style={[sd.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Détail du paiement</Text>
              </View>

              <PriceBreakdown price={ticket.price} tax={ticket.tax} />

              {/* Méthode de paiement + lien facture */}
              <View style={sd.paymentMeta}>
                {ticket.paymentMethod && (
                  <View style={[sd.paymentPill, { backgroundColor: theme.surfaceAlt }]}>
                    <Feather name="credit-card" size={12} color={theme.textMuted} />
                    <Text style={[sd.paymentPillText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{ticket.paymentMethod}</Text>
                  </View>
                )}
                {isDone && (
                  <TouchableOpacity style={[sd.invoicePill, { backgroundColor: theme.surface, borderColor: theme.borderLight }]} onPress={handleInvoice} activeOpacity={0.75}>
                    <Feather name="download" size={12} color={theme.text} />
                    <Text style={[sd.invoicePillText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Télécharger la facture</Text>
                  </TouchableOpacity>
                )}
              </View>

              <DividerLine />
            </>
          )}

          {/* 3. NOTATION */}
          {showRatingBlock && (
            <>
              <View style={[sd.ratingBlock, { backgroundColor: theme.surfaceAlt }]}>
                <Text style={[sd.ratingTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Comment s'est passée la mission ?</Text>
                <Text style={[sd.ratingSubtitle, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Votre avis aide les autres utilisateurs.</Text>
                <View style={sd.ratingStars}>
                  <StarRow rating={pendingRating} onRate={handleRate} starColor={theme.text} emptyColor={theme.borderLight} />
                </View>
                {pendingRating > 0 && (
                  <Text style={[sd.ratingPending, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                    {pendingRating === 5 ? 'Excellent !' :
                     pendingRating >= 4 ? 'Très bien' :
                     pendingRating >= 3 ? 'Correct' :
                     pendingRating >= 2 ? 'Peut mieux faire' : 'Décevant'}
                  </Text>
                )}
              </View>
              <DividerLine />
            </>
          )}

          {ratingSubmitted && (
            <>
              <View style={sd.ratingDone}>
                <Feather name="check-circle" size={18} color={COLORS.green} />
                <Text style={[sd.ratingDoneText, { color: COLORS.green, fontFamily: FONTS.sansMedium }]}>Merci pour votre évaluation !</Text>
              </View>
              <DividerLine />
            </>
          )}

          {hasRating && (
            <>
              <View style={sd.sectionHeader}>
                <Feather name="star" size={13} color={theme.textMuted} />
                <Text style={[sd.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Votre évaluation</Text>
              </View>
              <StarRow rating={ticket.clientRating} starColor={theme.text} emptyColor={theme.borderLight} />
              <DividerLine />
            </>
          )}

          {/* 4. CHRONOLOGIE */}
          {(ticket.createdAt || ticket.preferredTimeStart) && (
            <>
              <View style={sd.sectionHeader}>
                <Feather name="clock" size={13} color={theme.textMuted} />
                <Text style={[sd.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Chronologie</Text>
              </View>

              {ticket.createdAt && (
                <InfoRow
                  icon="circle"
                  label="Demande créée"
                  value={`${fmtDate(ticket.createdAt)} · ${fmtTime(ticket.createdAt)}`}
                />
              )}
              {ticket.preferredTimeStart && (
                <InfoRow
                  icon="calendar"
                  label="Date souhaitée"
                  value={`${fmtDateLong(ticket.preferredTimeStart)} · ${fmtTime(ticket.preferredTimeStart)}`}
                />
              )}
              {isDone && (
                <InfoRow icon="check-circle" label="Terminée" value="Mission complétée" iconBg={theme.isDark ? 'rgba(34,197,94,0.15)' : 'rgba(61,139,61,0.08)'} />
              )}

              <DividerLine />
            </>
          )}

          {/* 5. DETAILS SERVICE */}
          {(ticket.description || ticket.category || ticket.subcategory || address) && (
            <>
              <View style={sd.sectionHeader}>
                <Feather name="file-text" size={13} color={theme.textMuted} />
                <Text style={[sd.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Détails</Text>
              </View>

              {(ticket.category || ticket.subcategory) && (
                <InfoRow
                  icon="layers"
                  label="Catégorie"
                  value={[ticket.category?.name, ticket.subcategory?.name].filter(Boolean).join(' › ')}
                />
              )}
              {ticket.description && (
                <InfoRow icon="message-square" label="Description" value={ticket.description} />
              )}
              {address && (
                <InfoRow icon="map-pin" label="Adresse" value={address} />
              )}
              {ticket.urgent && (
                <InfoRow icon="zap" label="Priorité" value="Urgente" />
              )}
              {ticket.paymentMethod && (
                <InfoRow icon="credit-card" label="Paiement" value={ticket.paymentMethod} />
              )}

              <DividerLine />
            </>
          )}

          {/* 6. REFERENCE */}
          <View style={sd.sectionHeader}>
            <Feather name="info" size={13} color={theme.textMuted} />
            <Text style={[sd.sectionLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Informations</Text>
          </View>
          <InfoRow icon="hash" label="Référence" value={`#${ref}`} />
          {ticket.createdAt && (
            <InfoRow icon="calendar" label="Créée le" value={fmtDateLong(ticket.createdAt)} />
          )}

          {/* 7. ACTIONS CONTEXTUELLES */}
          <View style={sd.actions}>

            {isOngoing && (
              <>
                {onNavigateToOngoing && (
                  <ActionBtn
                    label={ticket.status === 'ONGOING' ? 'Suivre la mission en cours' : 'Voir le prestataire en route'}
                    icon={ticket.status === 'ONGOING' ? 'navigation' : 'crosshair'}
                    onPress={() => {
                      onClose();
                      onNavigateToOngoing(String(ticket.id));
                    }}
                    variant="primary"
                  />
                )}
                {ticket.provider?.userId && (
                  <ActionBtn
                    label="Envoyer un message"
                    icon="message-circle"
                    onPress={handleMessage}
                    variant="ghost"
                  />
                )}
                {ticket.provider?.phone && (
                  <ActionBtn
                    label="Contacter le prestataire"
                    icon="phone"
                    onPress={handleContact}
                    variant="ghost"
                  />
                )}
                <TouchableOpacity
                  style={sd.cancelLink}
                  onPress={() => {
                    Alert.alert(
                      'Annuler la mission',
                      'Voulez-vous vraiment annuler cette mission ?',
                      [
                        { text: 'Non', style: 'cancel' },
                        {
                          text: 'Oui, annuler',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await api.post(`/requests/${ticket.id}/cancel`);
                              onClose();
                            } catch (e: any) {
                              Alert.alert('Erreur', e?.message || 'Impossible d\'annuler la mission.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={[sd.cancelLinkText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Annuler la mission</Text>
                </TouchableOpacity>
              </>
            )}

            {isDone && (
              <>
                <ActionBtn
                  label="Télécharger la facture"
                  icon="file-text"
                  onPress={handleInvoice}
                  variant="primary"
                />
                <ActionBtn
                  label="Commander à nouveau"
                  icon="refresh-cw"
                  onPress={handleReorder}
                  variant="ghost"
                />
              </>
            )}

            {hasCoords && (
              <ActionBtn
                label="Ouvrir dans Maps"
                icon="navigation"
                onPress={openMap}
                variant="ghost"
              />
            )}

            <ActionBtn
              label="Un problème avec cette mission ?"
              icon="help-circle"
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
// STYLES
// ============================================================================

const sd = StyleSheet.create({
  scroll:    { paddingBottom: 48 },
  indicator: { width: 36, height: 4 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerLeft:  { flex: 1, paddingRight: 12 },
  headerRef:   { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 },
  headerTitle: { fontSize: 22, letterSpacing: -0.4, lineHeight: 28 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  statusBadgeText: { fontSize: 11, letterSpacing: 0.2 },

  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderLeftWidth: 3,
    marginHorizontal: 22, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  urgentText: { fontSize: 13 },

  // ── Map ──
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
    borderWidth: 2.5,
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
    borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
  },
  mapAddrText: { fontSize: 12, maxWidth: 260 },

  noMapAddr: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 22, marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  noMapAddrText: { fontSize: 13, flex: 1 },

  // ── Body ──
  body: { paddingHorizontal: 22 },

  // ── Provider ──
  providerRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  providerInfo:      { flex: 1 },
  providerName:      { fontSize: 17, marginBottom: 4 },
  providerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  providerRatingText:{ fontSize: 13 },
  providerJobsText:  { fontSize: 13 },
  providerCity:      { fontSize: 12 },
  providerActions:   { gap: 8 },
  comBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 5 },
    }),
  },

  // ── Price ──
  paymentMeta:     { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  paymentPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  paymentPillText: { fontSize: 12 },
  invoicePill:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  invoicePillText: { fontSize: 12 },

  // ── Rating ──
  ratingBlock: {
    borderRadius: 18,
    padding: 18, marginBottom: 4, alignItems: 'center',
  },
  ratingTitle:    { fontSize: 16, marginBottom: 4, textAlign: 'center' },
  ratingSubtitle: { fontSize: 13, marginBottom: 14, textAlign: 'center' },
  ratingStars:    { marginBottom: 10 },
  ratingPending:  { fontSize: 13 },
  ratingDone:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  ratingDoneText: { fontSize: 14 },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7 },

  // ── InfoRow ──
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  infoIconWrap: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoContent:  { flex: 1 },
  infoLabel:    { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  infoValue:    { fontSize: 14, lineHeight: 20 },

  // ── PriceBreakdown ──
  prbWrap:       { borderRadius: 16, padding: 16 },
  prbRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  prbLineLabel:  { fontSize: 14 },
  prbLineValue:  { fontSize: 14 },
  prbTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  prbTotalLabel: { fontSize: 15 },
  prbTotalValue: { fontSize: 28, letterSpacing: -0.8 },

  // ── ActionBtn ──
  abBase:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16 },
  abBaseText:    { fontSize: 15 },

  // ── Actions ──
  actions:    { marginTop: 4, gap: 10 },
  cancelLink: { alignItems: 'center', paddingVertical: 10 },
  cancelLinkText: { fontSize: 14 },
});
