// components/agenda/details.tsx — la feuille de détail d'une mission ou d'une
// demande à prendre, telle qu'elle existait dans l'onglet Missions (déplacée
// à l'identique lors de la refonte « Missions, c'est l'agenda »).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import MapView from 'react-native-maps';
import { MapPin } from '@/components/map/MapPin';
import { DotPin } from '@/components/map/pins';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { AccessBlock, ClientBlock, EarnRow, MissionTitle } from '@/components/mission/blocks';
import { PhotoGallery } from '@/components/mission/photos';
import { useTabBarPadding } from '@/app/(tabs)/_layout';
import { useCall } from '@/lib/webrtc/CallContext';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { MAP_PROVIDER, mapAppearance } from '@/lib/map/appearance';
import type { MissionBrief } from '@/lib/mission/brief';

const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', nl: 'nl-BE', en: 'en-GB' };
export const getLocale = () => LOCALE_MAP[i18n.language] || 'fr-FR';

export type MissionStatus =
  | 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE'
  | 'CANCELLED' | 'PENDING_PAYMENT' | 'EXPIRED'
  | 'QUOTE_PENDING' | 'QUOTE_SENT' | 'QUOTE_ACCEPTED';

export type Mission = {
  id: string;
  title: string;
  serviceType?: string;
  description: string;
  price: number;
  status: MissionStatus;
  location?: { address?: string; lat?: number; lng?: number };
  address?: string;
  client?: { id?: string; name: string; phone?: string };
  createdAt?: string;
  scheduledAt?: string;
  lat?: number;
  lng?: number;
  /** Fiche mission (services/missionBrief) — celle du serveur, sinon le repli. */
  brief: MissionBrief;
};


// --- Opportunity types ---
export interface Opportunity {
  id: number;
  serviceType: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  price: number | null;
  preferredTimeStart: string;
  urgent?: boolean;
  // Infos d'accès (déjà renvoyées par l'API — champs scalaires de Request)
  accessFloor?: number | null;
  accessHasElevator?: boolean | null;
  accessBuildingType?: string | null; // "apartment" | "house" | "office"
  accessNotes?: string | null;
  category: { id: number; name: string; icon: string | null };
  subcategory: { id: number; name: string } | null;
  client: { name: string; avatarUrl?: string | null; city?: string | null };
  brief: MissionBrief;
}

export function formatScheduledDate(iso: string, tr?: (k: string, opts?: any) => string): { day: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const locale = getLocale();

  const day = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const T = tr || ((k: string) => k);
  let relative = '';
  if (diffDays === 0) relative = T('stepper.today');
  else if (diffDays === 1) relative = T('missions.tomorrow');
  else if (diffDays <= 7) relative = T('missions.in_days', { n: diffDays });
  else relative = T('missions.in_days', { n: diffDays });

  return { day, time, relative };
}

// ============================================================================
// UTILS
// ============================================================================





export const STATUS_CFG: Record<MissionStatus, { labelKey: string; icon: string; active?: boolean; done?: boolean }> = {
  PUBLISHED:       { labelKey: 'ext.missions_status_published',     icon: 'radio',                    active: true },
  ACCEPTED:        { labelKey: 'ext.missions_status_accepted',      icon: 'check-circle',             active: true },
  ONGOING:         { labelKey: 'ext.missions_status_ongoing',       icon: 'zap',                      active: true },
  DONE:            { labelKey: 'ext.missions_status_done',          icon: 'check-circle',             done: true },
  CANCELLED:       { labelKey: 'ext.missions_status_cancelled',     icon: 'x-circle' },
  PENDING_PAYMENT: { labelKey: 'ext.missions_status_payment',       icon: 'credit-card' },
  EXPIRED:         { labelKey: 'ext.missions_status_expired',       icon: 'clock' },
  QUOTE_PENDING:   { labelKey: 'ext.missions_status_quote_pending', icon: 'file-text',                active: true },
  QUOTE_SENT:      { labelKey: 'ext.missions_status_quote_sent',    icon: 'check-circle' },
  QUOTE_ACCEPTED:  { labelKey: 'ext.missions_status_quote_accepted',icon: 'check-circle',             active: true },
};



export function MissionDetail({ mission, onNavigate, onComplete, onViewFull, inPane = false }: {
  inPane?: boolean;
  mission: Mission; onNavigate: () => void; onComplete: () => void; onViewFull: () => void;
}) {
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { initiateCall } = useCall();
  const tabBarPadding = useTabBarPadding();
  const cfg         = STATUS_CFG[mission.status] ?? STATUS_CFG.PUBLISHED;
  const canComplete = mission.status === 'ONGOING';
  const canNavigate = !!(cfg.active) && !!(mission.lat || mission.location?.lat);
  const address     = mission.location?.address || mission.address || '';
  const lat         = mission.lat || mission.location?.lat;
  const lng         = mission.lng || mission.location?.lng;
  const hasCoords   = !!(lat && lng);
  const createdAt   = mission.createdAt  ? new Date(mission.createdAt)  : null;
  const scheduledAt = mission.scheduledAt ? new Date(mission.scheduledAt) : null;

  const fmtT = (d: Date | null) => d ? d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtD = (d: Date | null) => d ? d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'long' }) : '—';

  const badgeBg    = cfg.done ? t.surface : cfg.active ? t.accent : t.surface;
  const badgeColor = cfg.done ? t.textSub : cfg.active ? t.accentText : t.textMuted;

  // Dans un volet (SplitPane), pas de contexte gorhom : ScrollView natif.
  const Scroller = inPane ? ScrollView : BottomSheetScrollView;
  return (
    <Scroller contentContainerStyle={[sd.scroll, { paddingBottom: tabBarPadding }]} showsVerticalScrollIndicator={false}>
      {/* -- Mini-carte -- */}
      {hasCoords ? (
        <View style={sd.mapContainer}>
          <MapView
            provider={MAP_PROVIDER}
            {...mapAppearance(t.isDark)}
            style={sd.map}
            initialRegion={{ latitude: lat!, longitude: lng!, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
            showsPointsOfInterest={false} showsBuildings={false}
          >
            <MapPin coordinate={{ latitude: lat!, longitude: lng! }}>
              <DotPin size={16} color={t.accent as string} />
            </MapPin>
          </MapView>
          <View style={sd.mapOverlay}>
            <View style={[sd.mapAddrBadge, { backgroundColor: t.isDark ? 'rgba(26,26,26,0.9)' : 'rgba(255,255,255,0.94)' }]}>
              <Feather name="map-pin" size={11} color={t.textSub} />
              <Text style={[sd.mapAddrText, { color: t.text }]} numberOfLines={1}>{address}</Text>
            </View>
          </View>
          {/* Badge statut flottant */}
          <View style={[sd.mapStatusPill, { backgroundColor: badgeBg }]}>
            <Feather name={cfg.icon as any} size={10} color={badgeColor} />
            <Text style={[sd.mapStatusText, { color: badgeColor }]}>{tr(cfg.labelKey)}</Text>
          </View>
        </View>
      ) : (
        <View style={[sd.mapFallback, { backgroundColor: t.surface }]}>
          <Feather name="map" size={24} color={t.textMuted} />
          <Text style={[sd.mapFallbackText, { color: t.textMuted }]}>{address || tr('ext.missions_no_address')}</Text>
        </View>
      )}

      <View style={sd.body}>
        {/* Fiche mission (planche 4A) : quoi, photos, accès, client, gain */}
        <MissionTitle brief={mission.brief} big />
        <View style={sd.blocks}>
          <PhotoGallery photos={mission.brief.photos} title={tr('mission.client_photos')} />
          <AccessBlock brief={mission.brief} />
          <ClientBlock
            brief={mission.brief}
            onMessage={mission.client?.id ? () => router.push({ pathname: '/messages/[userId]', params: { userId: mission.client!.id!, name: mission.client!.name, requestId: String(mission.id) } }) : undefined}
            onCall={mission.client?.id ? () => initiateCall({ targetUserId: mission.client!.id!, targetName: mission.client!.name, requestId: String(mission.id) }) : undefined}
            phone={mission.client?.phone ?? null}
          />
          <View style={sd.earnWrap}><EarnRow brief={mission.brief} /></View>
        </View>

        {/* Divider */}
        <View style={[sd.sep, { backgroundColor: t.border }]} />

        {/* Chronologie */}
        {(createdAt || scheduledAt) && (
          <>
            <Text style={[sd.sectionLabel, { color: t.textMuted }]}>{tr('missions.timeline')}</Text>
            {createdAt && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Feather name="circle" size={10} color={t.text} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>{tr('missions.order_placed')} · {fmtD(createdAt)} · {fmtT(createdAt)}</Text>
                </View>
              </View>
            )}
            {cfg.active && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Feather name="circle" size={10} color={t.text} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>{tr('missions.confirmed_action')}</Text>
                </View>
              </View>
            )}
            {scheduledAt && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Feather name="circle" size={10} color={t.textMuted} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>{tr('missions.departure_planned')} · {fmtD(scheduledAt)} · {fmtT(scheduledAt)}</Text>
                </View>
              </View>
            )}
            <View style={sd.infoRow}>
              <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Feather name="circle" size={10} color={t.textMuted} /></View>
              <View style={sd.infoContent}>
                <Text style={[sd.infoValue, { color: t.textMuted }]}>{tr('missions.finished_action')}</Text>
              </View>
            </View>
            <View style={[sd.sep, { backgroundColor: t.border }]} />
          </>
        )}

      </View>
        {/* -- CTA -- */}
        {mission.status === 'QUOTE_PENDING' && (
          <View style={sd.actionsBlock}>
            <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
              <Feather name="file-text" size={18} color={t.accentText} />
              <Text style={[sd.navBtnText, { color: t.accentText }]}>{tr('ext.missions_send_quote')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {mission.status === 'QUOTE_SENT' && (
          <View style={[sd.actionsBlock, { opacity: 0.6 }]}>
            <View style={[sd.navBtn, { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }]}>
              <Feather name="clock" size={18} color={t.textMuted} />
              <Text style={[sd.navBtnText, { color: t.textMuted }]}>{tr('missions.waiting_response')}</Text>
            </View>
          </View>
        )}
        {mission.status === 'QUOTE_ACCEPTED' && (
          <View style={sd.actionsBlock}>
            <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
              <Feather name="arrow-right" size={18} color={t.accentText} />
              <Text style={[sd.navBtnText, { color: t.accentText }]}>{tr('ext.missions_start_mission')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {(canNavigate || canComplete || cfg.active) && !['QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'].includes(mission.status) && (
          <View style={sd.actionsBlock}>
            {cfg.active && (
              <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
                <Feather name="arrow-right" size={18} color={t.accentText} />
                <Text style={[sd.navBtnText, { color: t.accentText }]}>{tr('ext.missions_resume_mission')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

    </Scroller>
  );
}

// ============================================================================
// OPPORTUNITY DETAIL -- Bottom Sheet (avant acceptation)
// ============================================================================

export function OpportunityDetail({ opportunity, onAccept, onDecline, accepting, inPane = false }: {
  inPane?: boolean;
  opportunity: Opportunity;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
}) {
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  const tabBarPadding = useTabBarPadding();
  const item = opportunity;
  const { day, time, relative } = formatScheduledDate(item.preferredTimeStart, tr);
  const lat = item.lat, lng = item.lng;
  const hasCoords = !!(lat && lng);
  const address = item.address || '';

  const buildingLabel =
    item.accessBuildingType === 'house'     ? tr('ext.missions_building_house')
    : item.accessBuildingType === 'office'    ? tr('ext.missions_building_office')
    : item.accessBuildingType === 'apartment' ? tr('ext.missions_building_apartment')
    : null;
  const accessRows: { icon: string; text: string }[] = [];
  if (item.accessFloor != null)
    accessRows.push({ icon: 'corner-right-up', text: item.accessFloor === 0 ? tr('ext.missions_ground_floor') : tr('ext.missions_floor_n', { n: item.accessFloor }) });
  if (item.accessHasElevator != null)
    accessRows.push({ icon: 'chevrons-up', text: item.accessHasElevator ? tr('ext.missions_elevator_available') : tr('ext.missions_no_elevator') });
  if (buildingLabel) accessRows.push({ icon: 'home', text: buildingLabel });

  const Scroller = inPane ? ScrollView : BottomSheetScrollView;
  return (
    <Scroller contentContainerStyle={[sd.scroll, { paddingBottom: tabBarPadding }]} showsVerticalScrollIndicator={false}>
      {/* -- Mini-carte -- */}
      {hasCoords ? (
        <View style={sd.mapContainer}>
          <MapView
            provider={MAP_PROVIDER}
            {...mapAppearance(t.isDark)}
            style={sd.map}
            initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
            showsPointsOfInterest={false} showsBuildings={false}
          >
            <MapPin coordinate={{ latitude: lat, longitude: lng }}>
              <DotPin size={16} color={t.accent as string} />
            </MapPin>
          </MapView>
          <View style={sd.mapOverlay}>
            <View style={[sd.mapAddrBadge, { backgroundColor: t.isDark ? 'rgba(26,26,26,0.9)' : 'rgba(255,255,255,0.94)' }]}>
              <Feather name="map-pin" size={11} color={t.textSub} />
              <Text style={[sd.mapAddrText, { color: t.text }]} numberOfLines={1}>{address}</Text>
            </View>
          </View>
          {item.urgent ? (
            <View style={[sd.mapStatusPill, { backgroundColor: t.accent }]}>
              <Feather name="zap" size={10} color={t.accentText} />
              <Text style={[sd.mapStatusText, { color: t.accentText }]}>{tr('ext.missions_urgent')}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[sd.mapFallback, { backgroundColor: t.surface }]}>
          <Feather name="map" size={24} color={t.textMuted} />
          <Text style={[sd.mapFallbackText, { color: t.textMuted }]}>{address || tr('ext.missions_no_address')}</Text>
        </View>
      )}

      <View style={sd.body}>
        {/* Fiche mission (planche 4A) : quoi, photos, accès, client, gain */}
        <MissionTitle brief={item.brief} big />
        <View style={sd.blocks}>
          <PhotoGallery photos={item.brief.photos} title={tr('mission.client_photos')} />
          <View style={sd.factRow}>
            <Feather name="calendar" size={14} color={t.textMuted} />
            <Text style={[sd.factText, { color: t.text }]}>{day} · {time} · {relative}</Text>
          </View>
          <AccessBlock brief={item.brief} />
          <ClientBlock brief={item.brief} />
          <View style={sd.earnWrap}><EarnRow brief={item.brief} /></View>
        </View>
      </View>
      {/* -- CTA Refuser / Accepter -- */}
      <View style={[sd.actionsBlock, { flexDirection: 'row', gap: 10 }]}>
        <TouchableOpacity
          style={[opp.declineBtn, { borderColor: t.border, flex: 1, justifyContent: 'center' }]}
          onPress={onDecline} disabled={accepting} activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={tr('ext.missions_refuse')}
        >
          <Feather name="x" size={18} color={t.textSub} />
          <Text style={[opp.declineText, { color: t.textSub }]}>{tr('ext.missions_refuse')}</Text>
        </TouchableOpacity>
        {/* Moment 6 : accepter est un geste — glisser, pas taper. */}
        <View style={{ flex: 2 }}>
          <SlideToConfirm label={tr('provider.accept')} onConfirm={onAccept} disabled={accepting} />
        </View>
      </View>
    </Scroller>
  );
}

// Styles conservés des anciennes cartes : bouton Refuser de la fiche, état vide des opportunités.
const opp = StyleSheet.create({
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  declineText: { fontSize: 14, fontFamily: FONTS.sansMedium },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.sansMedium, marginTop: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 20 },
});

const sd = StyleSheet.create({
  scroll: { paddingBottom: 80 },
  mapContainer: { height: 150, marginTop: 8, overflow: 'hidden', position: 'relative' },
  map:          { ...StyleSheet.absoluteFillObject },
  mapOverlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 24, backgroundColor: 'rgba(0,0,0,0.15)' },
  mapAddrBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  mapAddrText:  { fontSize: 12, fontFamily: FONTS.sansMedium, maxWidth: 260 },
  mapStatusPill:{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  mapStatusText:{ fontSize: 11, fontFamily: FONTS.sansMedium },
  mapFallback:  { height: 80, marginHorizontal: 20, marginTop: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 5 },
  mapFallbackText: { fontSize: 12, fontFamily: FONTS.sans },

  body: { paddingHorizontal: 20, paddingTop: 14 },
  blocks: { marginTop: 4, marginHorizontal: -20 },
  earnWrap: { paddingHorizontal: 24, marginTop: 18 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 16 },
  factText: { fontFamily: FONTS.sansMedium, fontSize: 13 },


  sep: { height: StyleSheet.hairlineWidth, marginVertical: 10 },

  sectionLabel: { fontSize: 11, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  infoIcon:     { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoContent:  { flex: 1 },
  infoValue:    { fontSize: 14, fontFamily: FONTS.sans, lineHeight: 20 },


  actionsBlock: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 10,
  },
  navBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15 },
  navBtnText:     { fontSize: 15, fontFamily: FONTS.sansMedium },
  completeBtnText:{ fontSize: 15, fontFamily: FONTS.sansMedium },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

