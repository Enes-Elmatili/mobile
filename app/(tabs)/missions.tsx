/* eslint-disable @typescript-eslint/no-unused-vars */
// app/(tabs)/missions.tsx — Provider Mission Hub
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Dimensions,
  Linking,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

const { width } = Dimensions.get('window');
const NET_RATE = 0.85;

// ============================================================================
// TYPES
// ============================================================================

type MissionStatus =
  | 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE'
  | 'CANCELLED' | 'PENDING_PAYMENT' | 'EXPIRED';

type Mission = {
  id: string;
  title: string;
  serviceType?: string;
  description: string;
  price: number;
  status: MissionStatus;
  location?: { address?: string; lat?: number; lng?: number };
  address?: string;
  client?: { name: string; phone?: string };
  createdAt?: string;
  scheduledAt?: string;
  lat?: number;
  lng?: number;
};

type Tab = 'upcoming' | 'history';
type HistoryFilter = 'all' | string; // 'all' ou un mois/type

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const formatShortDate = (d?: string) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const formatTime = (d?: string) => {
  if (!d) return null;
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const formatMonthKey = (d?: string) => {
  if (!d) return 'Inconnu';
  return new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

const STATUS_CFG: Record<MissionStatus, { label: string; color: string; bg: string; icon: string }> = {
  PUBLISHED:       { label: 'Publié',    color: '#B45309', bg: '#FEF3C7', icon: 'radio-outline' },
  ACCEPTED:        { label: 'Confirmé',  color: '#1D4ED8', bg: '#DBEAFE', icon: 'checkmark-circle-outline' },
  ONGOING:         { label: 'En cours',  color: '#15803D', bg: '#DCFCE7', icon: 'flash-outline' },
  DONE:            { label: 'Terminé',   color: '#374151', bg: '#F3F4F6', icon: 'checkmark-done-outline' },
  CANCELLED:       { label: 'Annulé',    color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle-outline' },
  PENDING_PAYMENT: { label: 'Paiement',  color: '#7C3AED', bg: '#EDE9FE', icon: 'card-outline' },
  EXPIRED:         { label: 'Expiré',    color: '#6B7280', bg: '#F3F4F6', icon: 'time-outline' },
};

const SERVICE_ICONS: Record<string, string> = {
  plomberie:    'water-outline',
  electricite:  'flash-outline',
  bricolage:    'hammer-outline',
  menage:       'sparkles-outline',
  jardinage:    'leaf-outline',
  demenagement: 'cube-outline',
  peinture:     'color-palette-outline',
};

const getServiceIcon = (type?: string): string => {
  if (!type) return 'construct-outline';
  const key = type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = Object.keys(SERVICE_ICONS).find(k => key.includes(k));
  return match ? SERVICE_ICONS[match] : 'construct-outline';
};

const UPCOMING_STATUSES: MissionStatus[] = ['PUBLISHED', 'ACCEPTED', 'ONGOING', 'PENDING_PAYMENT'];
const HISTORY_STATUSES: MissionStatus[] = ['DONE', 'CANCELLED', 'EXPIRED'];

// ============================================================================
// MISSION CARD
// ============================================================================

function MissionCard({
  mission,
  onPress,
  onNavigate,
  onComplete,
}: {
  mission: Mission;
  onPress: () => void;
  onNavigate: () => void;
  onComplete: () => void;
}) {
  const cfg = STATUS_CFG[mission.status] ?? STATUS_CFG.PUBLISHED;
  const net = mission.price * NET_RATE;
  const dateStr = mission.scheduledAt || mission.createdAt;
  const date = formatShortDate(dateStr);
  const time = formatTime(dateStr);
  const icon = getServiceIcon(mission.serviceType || mission.title);
  const address = mission.location?.address || mission.address || 'Adresse inconnue';
  const isActive = ['ACCEPTED', 'ONGOING'].includes(mission.status);
  const canComplete = mission.status === 'ONGOING';
  const canNavigate = isActive && (mission.lat || mission.location?.lat);

  return (
    <TouchableOpacity
      style={[mc.card, isActive && mc.cardActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Accent gauche pour missions actives */}
      {isActive && <View style={[mc.accentBar, { backgroundColor: cfg.color }]} />}

      <View style={mc.top}>
        {/* Icône service */}
        <View style={[mc.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={icon as any} size={18} color={cfg.color} />
        </View>

        {/* Contenu central */}
        <View style={mc.mid}>
          <Text style={mc.title}>{mission.title}</Text>
          {mission.client?.name && (
            <Text style={mc.client}>
              <Ionicons name="person-outline" size={11} color="#9CA3AF" /> {mission.client.name}
            </Text>
          )}
          <View style={mc.metaRow}>
            <Ionicons name="location-outline" size={12} color="#9CA3AF" />
            <Text style={mc.address} numberOfLines={1}>{address}</Text>
          </View>
        </View>

        {/* Droite : gains + date */}
        <View style={mc.right}>
          <Text style={mc.net}>{formatEuros(net)}</Text>
          <Text style={mc.netLabel}>net</Text>
          {date && <Text style={mc.date}>{date}</Text>}
          {time && <Text style={mc.time}>{time}</Text>}
        </View>
      </View>

      {/* Badge statut */}
      <View style={mc.footer}>
        <View style={[mc.badge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[mc.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {/* Actions rapides */}
        <View style={mc.actions}>
          {canNavigate && (
            <TouchableOpacity style={mc.actionBtn} onPress={onNavigate} activeOpacity={0.8}>
              <Ionicons name="navigate-outline" size={15} color="#1D4ED8" />
              <Text style={[mc.actionText, { color: '#1D4ED8' }]}>Itinéraire</Text>
            </TouchableOpacity>
          )}
          {canComplete && (
            <TouchableOpacity
              style={[mc.actionBtn, mc.completeBtn]}
              onPress={onComplete}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={15} color="#15803D" />
              <Text style={[mc.actionText, { color: '#15803D' }]}>Terminer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const mc = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
  cardActive: {
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  accentBar: { height: 3 },
  top: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  mid: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 1 },
  client: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  address: { fontSize: 11, color: '#9CA3AF', flex: 1 },
  right: { alignItems: 'flex-end', flexShrink: 0, gap: 2 },
  net: { fontSize: 22, fontWeight: '900', color: '#111', letterSpacing: -0.5 },
  netLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: -2 },
  date: { fontSize: 11, color: '#6B7280', fontWeight: '500', marginTop: 4 },
  time: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  footer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 12,
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, backgroundColor: '#EFF6FF',
  },
  completeBtn: { backgroundColor: '#F0FDF4' },
  actionText: { fontSize: 12, fontWeight: '700' },
});

// ============================================================================
// HISTORY FILTER BAR
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
  return (
  <FlatList
    horizontal
    data={options}
    keyExtractor={item => item.key}
    showsHorizontalScrollIndicator={false}
    // Remplace fb.wrap par un style qui autorise l'expansion
    contentContainerStyle={{
      paddingHorizontal: 17, 
      gap: 11, // Gère l'espace entre les chips sans les écraser
      alignItems: 'center'
    }}
    // Empêche la liste de s'étirer verticalement si elle est dans une autre liste
    style={{ flexGrow: 0 }} 
    renderItem={({ item }) => {
      const active = item.key === selected;
      return (
        <TouchableOpacity
          style={[fb.chip, active && fb.chipActive]}
          onPress={() => onSelect(item.key)}
          activeOpacity={0.8}
        >
          {/* Ajoute numberOfLines={1} pour forcer le texte sur une ligne */}
          <Text 
            numberOfLines={1} 
            style={[fb.chipText, active && fb.chipTextActive]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      );
    }}
  />
);
}

const fb = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 11, gap: 8, backgroundColor: '#F3F4F6' },
  chip: {
    paddingHorizontal: 18, paddingVertical: 0, height: 32,
    borderRadius: 20, backgroundColor: '#F3F4F6',
    borderWidth: 6, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#172247', borderColor: '#172247' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#6B7280', textAlign: 'center' },
  chipTextActive: { color: '#FFF', fontWeight: '700', textAlign: 'center' },
});

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ tab, onGoOnline }: { tab: Tab; onGoOnline: () => void }) {
  if (tab === 'history') {
    return (
      <View style={es.wrap}>
        <View style={es.iconWrap}>
          <Ionicons name="time-outline" size={40} color="#D1D5DB" />
        </View>
        <Text style={es.title}>Aucun historique</Text>
        <Text style={es.sub}>Vos missions terminées apparaîtront ici.</Text>
      </View>
    );
  }
  return (
    <View style={es.wrap}>
      <View style={es.iconWrap}>
        <Ionicons name="navigate-circle-outline" size={48} color="#D1D5DB" />
      </View>
      <Text style={es.title}>Aucune mission à venir</Text>
      <Text style={es.sub}>Passez en ligne pour commencer à recevoir des missions.</Text>
      <TouchableOpacity style={es.cta} onPress={onGoOnline} activeOpacity={0.85}>
        <View style={es.ctaDot} />
        <Text style={es.ctaText}>Passer en ligne</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const es = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 80 },
  iconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0A0A0A', paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 20,
  },
  ctaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});

// ============================================================================
// HELPERS — AVATAR INITIALS
// ============================================================================

function ClientAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
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
// BOTTOM SHEET DETAIL — PREMIUM VERSION
// ============================================================================

function MissionDetail({
  mission,
  onNavigate,
  onComplete,
  onViewFull,
}: {
  mission: Mission;
  onNavigate: () => void;
  onComplete: () => void;
  onViewFull: () => void;
}) {
  const cfg = STATUS_CFG[mission.status] ?? STATUS_CFG.PUBLISHED;
  const net = mission.price * NET_RATE;
  const canComplete = mission.status === 'ONGOING';
  const canNavigate = ['ACCEPTED', 'ONGOING'].includes(mission.status);
  const isDone = mission.status === 'DONE';
  const address = mission.location?.address || mission.address || '';
  const lat = mission.lat || mission.location?.lat;
  const lng = mission.lng || mission.location?.lng;
  const hasCoords = !!(lat && lng);

  const createdAt = mission.createdAt ? new Date(mission.createdAt) : null;
  const scheduledAt = mission.scheduledAt ? new Date(mission.scheduledAt) : null;

  const fmtTime = (d: Date | null) =>
    d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '—';

  return (
    <BottomSheetScrollView contentContainerStyle={sd.scroll}>
      {/* Handle */}
      <View style={sd.handle} />

      {/* ── Mini-Map ── */}
      {hasCoords ? (
        <View style={sd.mapContainer}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={sd.map}
            initialRegion={{
              latitude: lat!,
              longitude: lng!,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={{ latitude: lat!, longitude: lng! }}>
              <View style={sd.mapMarker}>
                <Ionicons name="location" size={22} color="#FFF" />
              </View>
            </Marker>
          </MapView>
          {/* Overlay gradient bas + badge adresse */}
          <View style={sd.mapOverlay}>
            <View style={sd.mapAddressBadge}>
              <Ionicons name="location-outline" size={12} color="#6B7280" />
              <Text style={sd.mapAddressText} numberOfLines={1}>{address}</Text>
            </View>
          </View>
          {/* Status pill flottant */}
          <View style={[sd.mapStatusPill, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[sd.mapStatusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      ) : (
        /* Fallback sans coords */
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
        {/* ── Titre + Client ── */}
        <View style={sd.titleRow}>
          <View style={sd.titleBlock}>
            <Text style={sd.title}>{mission.title}</Text>
            {mission.client?.name && (
              <View style={sd.clientRow}>
                <ClientAvatar name={mission.client.name} size={28} />
                <Text style={sd.clientName}>{mission.client.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Bloc Finance ── */}
        <View style={sd.section}>
          <View style={sd.sectionLabelRow}>
            <Ionicons name="cash-outline" size={13} color="#9CA3AF" />
            <Text style={sd.sectionLabel}>Gains</Text>
          </View>
          <View style={sd.earningsRow}>
            <View style={sd.earningNetBlock}>
              <Text style={sd.earningNetLabel}>Net (85%)</Text>
              <Text style={sd.earningNet}>{formatEuros(net)}</Text>
            </View>
            <View style={sd.earningDivider} />
            <View style={sd.earningGrossBlock}>
              <Text style={sd.earningGrossLabel}>Brut</Text>
              <Text style={sd.earningGross}>{formatEuros(mission.price)}</Text>
            </View>
          </View>
        </View>

        {/* ── Timeline ── */}
        {(createdAt || scheduledAt) && (
          <View style={sd.section}>
            <View style={sd.sectionLabelRow}>
            <Ionicons name="time-outline" size={13} color="#9CA3AF" />
            <Text style={sd.sectionLabel}>Chronologie</Text>
          </View>
            <View style={sd.timeline}>
              {createdAt && (
                <View style={sd.timelineRow}>
                  <View style={sd.timelineDotDone} />
                  <View style={sd.timelineConnector} />
                  <View style={sd.timelineContent}>
                    <Text style={sd.timelineTitle}>Commande passée</Text>
                    <Text style={sd.timelineSub}>{fmtDate(createdAt)} · {fmtTime(createdAt)}</Text>
                  </View>
                </View>
              )}
              {scheduledAt && (
                <View style={sd.timelineRow}>
                  <View style={[sd.timelineDot, canNavigate ? sd.timelineDotActive : sd.timelineDotDone]} />
                  <View style={sd.timelineConnector} />
                  <View style={sd.timelineContent}>
                    <Text style={sd.timelineTitle}>Départ prévu</Text>
                    <Text style={sd.timelineSub}>{fmtDate(scheduledAt)} · {fmtTime(scheduledAt)}</Text>
                  </View>
                </View>
              )}
              <View style={sd.timelineRow}>
                <View style={[sd.timelineDot, isDone ? sd.timelineDotDone : sd.timelineDotPending]} />
                <View style={[sd.timelineContent, { marginLeft: 0 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    {isDone && <Ionicons name="checkmark-circle" size={14} color="#059669" />}
                    <Text style={[sd.timelineTitle, isDone && { color: '#059669' }]}>
                      {isDone ? 'Mission terminée' : 'Arrivée sur place'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Bloc Lieu ── */}
        {(address || mission.description) && (
          <View style={sd.section}>
            <View style={sd.sectionLabelRow}>
            <Ionicons name="information-circle-outline" size={13} color="#9CA3AF" />
            <Text style={sd.sectionLabel}>Détails</Text>
          </View>
            {address ? (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="location-outline" size={15} color="#3B82F6" />
                </View>
                <View style={sd.infoContent}>
                  <Text style={sd.infoLabel}>ADRESSE</Text>
                  <Text style={sd.infoValue}>{address}</Text>
                </View>
              </View>
            ) : null}
            {mission.description ? (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="document-text-outline" size={15} color="#16A34A" />
                </View>
                <View style={sd.infoContent}>
                  <Text style={sd.infoLabel}>DESCRIPTION</Text>
                  <Text style={sd.infoValue}>{mission.description}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Bloc Client ── */}
        {mission.client && (
          <View style={sd.section}>
            <View style={sd.sectionLabelRow}>
            <Ionicons name="person-outline" size={13} color="#9CA3AF" />
            <Text style={sd.sectionLabel}>Client</Text>
          </View>
            <View style={sd.clientCard}>
              <ClientAvatar name={mission.client.name} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={sd.clientCardName}>{mission.client.name}</Text>
                {mission.client.phone && (
                  <Text style={sd.clientCardPhone}>{mission.client.phone}</Text>
                )}
              </View>
              {mission.client.phone && (
                <TouchableOpacity
                  style={sd.callBtn}
                  onPress={() => Linking.openURL(`tel:${mission.client!.phone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={18} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Actions contextuelles ── */}
        <View style={sd.actions}>
          {canNavigate && (
            <TouchableOpacity style={sd.navBtn} onPress={onNavigate} activeOpacity={0.85}>
              <Ionicons name="navigate" size={18} color="#FFF" />
              <Text style={sd.navBtnText}>S'y rendre (GPS)</Text>
            </TouchableOpacity>
          )}
          {canComplete && (
            <TouchableOpacity style={sd.completeBtn} onPress={onComplete} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={sd.completeBtnText}>Terminer la mission</Text>
            </TouchableOpacity>
          )}

        </View>
      </View>
    </BottomSheetScrollView>
  );
}

const sd = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },

  // ── Map ──
  mapContainer: {
    height: 180, marginHorizontal: 0, marginTop: 8,
    borderRadius: 0, overflow: 'hidden', position: 'relative',
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapMarker: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#172247',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 5 },
    }),
  },
  mapOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 30,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.45))',
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

  // ── Body ──
  body: { paddingHorizontal: 20, paddingTop: 16 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  statusText: { fontSize: 12, fontWeight: '700' },

  // ── Title ──
  titleRow: { marginBottom: 20 },
  titleBlock: { flex: 1, gap: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientName: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  // ── Sections ──
  section: {
    backgroundColor: '#F8F9FB', borderRadius: 16,
    padding: 14, marginBottom: 12,
  },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Finance ──
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
  earningNetBlock: { flex: 2, alignItems: 'flex-start' },
  earningNetLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  earningNet: { fontSize: 32, fontWeight: '900', color: '#059669', letterSpacing: -1 },
  earningDivider: { width: 1, height: 44, backgroundColor: '#E5E7EB', marginHorizontal: 16 },
  earningGrossBlock: { flex: 1, alignItems: 'flex-start' },
  earningGrossLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  earningGross: { fontSize: 16, fontWeight: '500', color: '#9CA3AF' },

  // ── Timeline ──
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3, marginRight: 12, flexShrink: 0 },
  timelineDotDone: { width: 12, height: 12, borderRadius: 6, marginTop: 3, marginRight: 12, flexShrink: 0, backgroundColor: '#059669' },
  timelineDotActive: { backgroundColor: '#172247' },
  timelineDotPending: { backgroundColor: '#D1D5DB', borderWidth: 2, borderColor: '#9CA3AF' },
  timelineConnector: { position: 'absolute', left: 5, top: 16, width: 2, height: 18, backgroundColor: '#E5E7EB' },
  timelineContent: { flex: 1, marginBottom: 16, marginLeft: 0 },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: '#111' },
  timelineSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // ── Info rows ──
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 14, color: '#111', lineHeight: 20 },

  // ── Client card ──
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientCardName: { fontSize: 15, fontWeight: '700', color: '#111' },
  clientCardPhone: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center',
  },

  // ── Actions ──
  actions: { marginTop: 8, gap: 10, marginBottom: 8 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#172247', borderRadius: 16, paddingVertical: 15,
  },
  navBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 15,
  },
  completeBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  invoiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EDE9FE', borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  invoiceBtnText: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  detailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 16, paddingVertical: 14,
  },
  detailBtnText: { fontSize: 15, fontWeight: '700', color: '#111' },
});

// ============================================================================
// TAB BAR
// ============================================================================

function TabBar({ tab, onChange, upcomingCount }: {
  tab: Tab;
  onChange: (t: Tab) => void;
  upcomingCount: number;
}) {
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: tab === 'upcoming' ? 0 : 1,
      tension: 200, friction: 20, useNativeDriver: false,
    }).start();
  }, [tab]);

  const indicatorLeft = indicatorX.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  return (
    <View style={tb.wrap}>
      <Animated.View style={[tb.indicator, { left: indicatorLeft }]} />
      {(['upcoming', 'history'] as Tab[]).map(t => (
        <TouchableOpacity key={t} style={tb.tab} onPress={() => onChange(t)} activeOpacity={0.7}>
          <Text style={[tb.label, tab === t && tb.labelActive]}>
            {t === 'upcoming' ? 'À venir' : 'Historique'}
          </Text>
          {t === 'upcoming' && upcomingCount > 0 && (
            <View style={tb.badge}>
              <Text style={tb.badgeText}>{upcomingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', backgroundColor: '#F3F4F6',
    marginHorizontal: 16, marginVertical: 12,
    borderRadius: 14, padding: 4, position: 'relative',
  },
  indicator: {
    position: 'absolute', top: 4, bottom: 4,
    width: '50%', backgroundColor: '#FFF', borderRadius: 11,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, gap: 6,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  labelActive: { color: '#111', fontWeight: '700' },
  badge: {
    backgroundColor: '#172247', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Missions() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [completing, setCompleting] = useState<string | null>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['55%', '90%'], []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const searchWidth = useRef(new Animated.Value(0)).current;

  // ── Data ──
  const loadMissions = useCallback(async () => {
    try {
      setError(null);
      const response = await api.requests.list();
      // api.requests.list() appelle désormais GET /requests (corrigé dans api.ts)

      // Le backend retourne { code, data: [...] }
      const raw: any[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];

      // Normaliser les champs backend → type Mission
      // Le backend retourne : serviceType, address (flat), client { name, phone }, lat, lng
      const list: Mission[] = raw.map((r: any) => ({
        id: String(r.id),
        title: r.serviceType || r.title || 'Mission',
        serviceType: r.serviceType,
        description: r.description || '',
        price: r.price || 0,
        status: r.status as MissionStatus,
        address: r.address,
        location: r.address ? { address: r.address, lat: r.lat, lng: r.lng } : undefined,
        lat: r.lat,
        lng: r.lng,
        client: r.client
          ? { name: r.client.name || '', phone: r.client.phone }
          : undefined,
        createdAt: r.createdAt,
        scheduledAt: r.preferredTimeStart || r.scheduledAt,
      }));

      setMissions(list);
    } catch (e: any) {
      console.error('Missions load error:', e);
      setError('Erreur de chargement des missions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadMissions(); }, [loadMissions]);
  const onRefresh = () => { setRefreshing(true); loadMissions(); };

  const expandSearch = () => {
    setSearchActive(true);
    Animated.spring(searchWidth, { toValue: 1, tension: 200, friction: 20, useNativeDriver: false }).start();
  };

  const collapseSearch = () => {
    if (!searchQuery) {
      setSearchActive(false);
      Animated.spring(searchWidth, { toValue: 0, tension: 200, friction: 20, useNativeDriver: false }).start();
    }
  };

  // ── Filtered lists ──
  const upcomingMissions = useMemo(
    () => missions.filter(m => UPCOMING_STATUSES.includes(m.status)),
    [missions]
  );

  const historyMissions = useMemo(
    () => missions.filter(m => HISTORY_STATUSES.includes(m.status)),
    [missions]
  );

  // Filtres historique : tous les mois disponibles
  const historyFilterOptions = useMemo(() => {
    const months = new Set(historyMissions.map(m => formatMonthKey(m.createdAt)));
    return [
      { key: 'all', label: 'Tous' },
      ...Array.from(months).map(m => ({ key: m, label: m })),
    ];
  }, [historyMissions]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return historyMissions;
    return historyMissions.filter(m => formatMonthKey(m.createdAt) === historyFilter);
  }, [historyMissions, historyFilter]);

  const displayedList = useMemo(() => {
    const base = tab === 'upcoming' ? upcomingMissions : filteredHistory;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(m =>
      m.title.toLowerCase().includes(q) ||
      (m.address || m.location?.address || '').toLowerCase().includes(q) ||
      (m.client?.name || '').toLowerCase().includes(q)
    );
  }, [tab, upcomingMissions, filteredHistory, searchQuery]);

  // ── Actions ──
  const handleMissionPress = async (missionId: string) => {
    setLoadingDetails(true);
    bottomSheetRef.current?.expand();
    try {
      const raw = await api.get(`/requests/${missionId}`);
      // GET /requests/:id retourne { code, data: { ...request } }
      const r = raw?.data || raw;
      setSelectedMission({
        id: String(r.id),
        title: r.serviceType || r.title || 'Mission',
        serviceType: r.serviceType,
        description: r.description || '',
        price: r.price || 0,
        status: r.status,
        address: r.address,
        location: r.address ? { address: r.address, lat: r.lat, lng: r.lng } : undefined,
        lat: r.lat,
        lng: r.lng,
        client: r.client
          ? { name: r.client.name || '', phone: r.client.phone }
          : undefined,
        createdAt: r.createdAt,
        scheduledAt: r.preferredTimeStart || r.scheduledAt,
      });
    } catch {
      console.error('Error loading mission details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleNavigate = (mission: Mission) => {
    const lat = mission.lat || mission.location?.lat;
    const lng = mission.lng || mission.location?.lng;
    if (!lat || !lng) {
      Alert.alert('Adresse indisponible', 'Les coordonnées de la mission ne sont pas disponibles.');
      return;
    }
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleComplete = useCallback((mission: Mission) => {
    Alert.alert(
      'Terminer la mission',
      `Confirmer la fin de "${mission.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setCompleting(mission.id);
            try {
              const response = await api.post(`/requests/${mission.id}/complete`);
              const earnings = response.earnings ?? (mission.price * NET_RATE);

              // Fermer le bottom sheet si ouvert sur cette mission
              if (selectedMission?.id === mission.id) {
                bottomSheetRef.current?.close();
              }

              Alert.alert(
                'Mission terminée !',
                `Gains : ${formatEuros(earnings)}`,
                [{ text: 'OK', onPress: () => {
                  loadMissions();
                  router.push(`/request/${mission.id}/earnings`);
                }}]
              );
            } catch (error: any) {
              if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
                await loadMissions();
                Alert.alert('Statut mis à jour', 'La mission a déjà changé d\'état.');
              } else {
                Alert.alert('Erreur', error?.message || 'Impossible de terminer la mission');
              }
            } finally {
              setCompleting(null);
            }
          },
        },
      ]
    );
  }, [selectedMission, loadMissions, router]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
    ), []
  );

  // ── Render card ──
  const renderMission = useCallback(({ item }: { item: Mission }) => (
    <MissionCard
      mission={item}
      onPress={() => handleMissionPress(item.id)}
      onNavigate={() => handleNavigate(item)}
      onComplete={() => handleComplete(item)}
    />
  ), [handleComplete]);

  // ── Loading ──
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
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Missions</Text>
            {upcomingMissions.length > 0 && (
              <Text style={s.headerSub}>
                {upcomingMissions.length} mission{upcomingMissions.length > 1 ? 's' : ''} à venir
              </Text>
            )}
          </View>
          {!searchActive && (
            <TouchableOpacity style={s.searchIconBtn} onPress={expandSearch} activeOpacity={0.7}>
              <Ionicons name="search-outline" size={22} color="#172247" />
            </TouchableOpacity>
          )}
        </View>
        {searchActive && (
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginLeft: 12 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Rechercher une mission..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onBlur={collapseSearch}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ paddingHorizontal: 10 }}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── Tabs ── */}
      <TabBar tab={tab} onChange={setTab} upcomingCount={upcomingMissions.length} />

      {/* ── History Filters ── */}
      {tab === 'history' && historyFilterOptions.length > 1 && (
        <FilterBar
          options={historyFilterOptions}
          selected={historyFilter}
          onSelect={setHistoryFilter}
        />
      )}

      {/* ── Error ── */}
      {error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadMissions}>
            <Text style={s.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ── */}
      <FlatList
        data={displayedList}
        renderItem={renderMission}
        keyExtractor={item => item.id}
        contentContainerStyle={[s.list, !displayedList.length && s.listEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#172247" />
        }
        ListEmptyComponent={
          <EmptyState
            tab={tab}
            onGoOnline={() => router.replace('/(tabs)/dashboard')}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Bottom Sheet ── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        {loadingDetails ? (
          <ActivityIndicator size="large" color="#172247" style={{ marginTop: 60 }} />
        ) : selectedMission ? (
          <MissionDetail
            mission={selectedMission}
            onNavigate={() => handleNavigate(selectedMission)}
            onComplete={() => {
              bottomSheetRef.current?.close();
              handleComplete(selectedMission);
            }}
            onViewFull={() => {
              bottomSheetRef.current?.close();
              router.push({ pathname: '/request/[id]/ongoing', params: { id: selectedMission.id } });
            }}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FB' },

  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  searchIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 14,
    height: 44, marginTop: 12,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: '#111',
    paddingHorizontal: 10, height: 44,
  },
  searchIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111' },
  headerSub: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  listEmpty: { flex: 1 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 4,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '500' },
  retryText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
});