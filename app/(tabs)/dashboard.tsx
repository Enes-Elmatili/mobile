/* eslint-disable react-hooks/exhaustive-deps */
// app/(tabs)/dashboard.tsx
import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
    StatusBar,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { runWhenIdle } from '@/lib/idle';
import { usePressScale } from '@/lib/motion/press';
import { useSheetMotion } from '@/lib/motion/sheet';
import { CascadeItem } from '@/lib/motion/useCascade';
import { Skeleton } from '@/components/ui/Skeleton';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { translateRequestServiceRaw, translateCategoryRaw } from '@/lib/categoryLabel';
import { feedback } from '@/lib/feedback/feedback';
import { useAuth } from '../../lib/auth/AuthContext';
import { useSocket } from '../../lib/SocketContext';
import { useCallParty } from '../../lib/webrtc/CallContext';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProviderDashboard from '@/components/provider/ProviderDashboard';
import { useTabBarPadding } from './_layout';
import { useNavStore, clientDisc, BarLock } from '@/stores/nav';
import { formatEUR } from '@/lib/format';
import { useAppTheme, FONTS, COLORS, darkTokens } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import { useAndroidBackClose } from '@/hooks/use-android-back-close';
import { PulseDot } from '@/components/ui/PulseDot';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import { useInvoice } from '@/hooks/useInvoice';
import { devError } from '@/lib/logger';
import { cleanName } from '@/lib/displayName';
import FixedCard from '@/components/ui/Card';
import FixedSectionHeader from '@/components/ui/SectionHeader';
import FixedIconBtn from '@/components/ui/IconBtn';
import FixedStatusChip from '@/components/ui/StatusBadge';
import FixedAvatar from '@/components/ui/Avatar';
import FixedPrice from '@/components/ui/PriceDisplay';
import { useLayoutClass } from '@/lib/layout';

// ─── Press feel constants (tier-1 haptic + opacity) ─────────────────────────
const PRESS_PRIMARY   = 0.85;  // CTAs, cards, mission island
const PRESS_SECONDARY = 0.7;   // Text links, icon buttons, list items
const hapticLight  = () => feedback.haptic('light');
const hapticMedium = () => feedback.haptic('medium');

// ============================================================================
// TYPES
// ============================================================================

interface DashboardData {
  me: { id: string; email: string; name?: string; city?: string; roles: string[] };
  stats: { activeRequests: number; completedRequests: number; totalSpent: number };
  requests: {
    id: string;
    title: string;
    serviceType?: string;
    status: string;
    description?: string;
    price?: number;
    address?: string;
    lat?: number;
    lng?: number;
    createdAt: string;
    expiresAt?: string;
    preferredTimeStart?: string | null;
    pricingMode?: string | null;
    calloutFee?: number | null;
    category?: { id: number; name: string; icon?: string };
    subcategory?: { id: number; name: string };
    provider?: { id: string; name?: string; avatarUrl?: string | null } | null;
  }[];
}

// ─── Helper : une request est "planifiée future" si preferredTimeStart > now ────
const isScheduledFuture = (r: { preferredTimeStart?: string | null }): boolean => {
  if (!r?.preferredTimeStart) return false;
  return new Date(r.preferredTimeStart).getTime() > Date.now();
};

// ============================================================================
// UTILS
// ============================================================================

const getStatusInfo = (status: string, t: (key: string) => string) => {
  const s = (status || 'PENDING').toUpperCase();
  const map: Record<string, { label: string; icon: string; ledColor: string }> = {
    DONE:            { label: t('dashboard.status_done'),      icon: 'check-circle', ledColor: COLORS.green },
    CANCELLED:       { label: t('dashboard.status_cancelled'), icon: 'x-circle',     ledColor: COLORS.red },
    ONGOING:         { label: t('dashboard.status_ongoing'),   icon: 'clock',        ledColor: COLORS.green },
    PUBLISHED:       { label: t('dashboard.status_published'), icon: 'radio',        ledColor: COLORS.amber },
    ACCEPTED:        { label: t('dashboard.status_accepted'),  icon: 'check',        ledColor: COLORS.green },
    PENDING_PAYMENT: { label: t('dashboard.status_payment'),   icon: 'credit-card',  ledColor: COLORS.amber },
    QUOTE_PENDING:   { label: t('dashboard.status_quote_pending'),  icon: 'file-text',    ledColor: COLORS.amber },
    QUOTE_SENT:      { label: t('dashboard.status_quote_sent'),     icon: 'file-text',    ledColor: COLORS.green },
    QUOTE_ACCEPTED:  { label: t('dashboard.status_quote_accepted'), icon: 'check-circle', ledColor: COLORS.green },
    QUOTE_REFUSED:   { label: t('dashboard.status_cancelled'),      icon: 'x-circle',     ledColor: COLORS.red },
    QUOTE_EXPIRED:   { label: t('dashboard.status_quote_expired'),  icon: 'clock',        ledColor: COLORS.red },
    EXPIRED:         { label: t('dashboard.status_expired'),   icon: 'clock',        ledColor: COLORS.red },
  };
  return map[s] || { label: s, icon: 'help-circle', ledColor: COLORS.amber };
};

const getGreeting = (t: (key: string) => string) => {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.greeting_morning');
  if (h < 18) return t('dashboard.greeting_afternoon');
  return t('dashboard.greeting_evening');
};

const getServiceIcon = (label?: string): string => {
  if (!label) return 'tool';
  const t = label.toLowerCase();
  if (t.includes('bricol'))                             return 'tool';
  if (t.includes('jardin') || t.includes('pelouse'))    return 'feather';
  if (t.includes('ménage') || t.includes('nettoyage'))  return 'star';
  if (t.includes('démén') || t.includes('demen'))       return 'package';
  if (t.includes('peint'))                              return 'edit-2';
  if (t.includes('plomb'))                              return 'droplet';
  if (t.includes('électr') || t.includes('electr'))     return 'zap';
  if (t.includes('chauff'))                             return 'zap';
  if (t.includes('serrur'))                             return 'key';
  if (t.includes('urgence'))                            return 'tool';
  if (t.includes('rénov') || t.includes('renov'))       return 'tool';
  return 'tool';
};

// ============================================================================
// CARTES DE SERVICES — le catalogue affiché sur l'accueil
// ============================================================================

// Le `label` est volontairement absent : on rend `t(`category.${key}`)` au moment
// du render — comme ça la card s'affiche en NL / EN si le user a switché de langue.
// NB : pas de compteur de prestataires ici — aucune API ne fournit de vrais
// compteurs par catégorie, on n'affiche donc AUCUN chiffre mocké.
const SERVICE_CARDS = [
  { key: 'plomberie',   icon: 'droplet',  theme: 'black' as const, led: COLORS.green,  category: 'plomberie'   },
  { key: 'electricite', icon: 'zap',      theme: 'light' as const, led: COLORS.green,  category: 'electricite' },
  { key: 'serrurerie',  icon: 'key',      theme: 'light' as const, led: COLORS.green,  category: 'serrurerie'  },
  { key: 'chauffage',   icon: 'zap',      theme: 'light' as const, led: COLORS.green,  category: 'chauffage'   },
  { key: 'bricolage',   icon: 'tool',     theme: 'light' as const, led: COLORS.green,  category: 'bricolage'   },
  { key: 'peinture',    icon: 'edit-2',   theme: 'light' as const, led: COLORS.green,  category: 'peinture'    },
];

// Catalogue actuel : uniquement Plomberie et Serrurerie
const LAUNCH_CARDS = SERVICE_CARDS.filter(c => c.key === 'plomberie' || c.key === 'serrurerie');


// ============================================================================
// MISSION ISLAND — active request or empty state
// ============================================================================

// Le compte à rebours de la recherche : seul ce texte se redessine chaque
// seconde, pas toute la carte de mission.
function SearchCountdown({ expiresAt, fallback, color }: { expiresAt: string | null; fallback: number; color: string }) {
  const left = useCallback(() => expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : null, [expiresAt]);
  const [seconds, setSeconds] = useState(() => left() ?? fallback);
  useEffect(() => {
    const iv = setInterval(() => setSeconds((p) => left() ?? Math.max(0, p - 1)), 1000);
    return () => clearInterval(iv);
  }, [left]);
  return (
    <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color, letterSpacing: 0.5, fontVariant: ['tabular-nums'] }}>
      {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
    </Text>
  );
}

function MissionIsland({
  activeMission,
  searchingMission,
  quoteMission,
  onActiveMissionPress,
  onSearchingPress,
  onQuotePress,
  onCallProvider,
  onMessageProvider,
  theme,
}: {
  activeMission: DashboardData['requests'][0] | null;
  searchingMission: DashboardData['requests'][0] | null;
  quoteMission?: DashboardData['requests'][0] | null;
  onActiveMissionPress: () => void;
  onSearchingPress: () => void;
  onQuotePress?: () => void;
  onCallProvider?: () => void;
  onMessageProvider?: () => void;
  theme: AppTheme;
}) {
  const { t } = useTranslation();
  const [etaLabel, setEtaLabel] = useState<string>(t('dashboard.loading_eta'));
  // "LIVE · GPS" ne s'affiche que si on a de vraies coordonnées prestataire —
  // pas quand l'ETA vient du fallback haversine sans position live.
  const [hasLiveGps, setHasLiveGps] = useState(false);
  const SEARCH_TIMEOUT = 15 * 60;
  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // NOTE — la boucle de pulse a été retirée : sa seule sortie (`pulseOpacity`)
  // n'était rendue nulle part. Elle faisait tourner une animation infinie sans
  // aucun pixel à l'écran, tant qu'une mission était active. Si le halo revient
  // un jour, le rebrancher en Reanimated (cf. CockpitIsland), pas en Animated.

  // ETA from API
  useEffect(() => {
    if (!activeMission) return;
    const st = activeMission.status.toUpperCase();
    if (['COMPLETED', 'DONE', 'CANCELLED', 'EXPIRED'].includes(st)) return;
    if (st === 'ONGOING') { setEtaLabel(t('dashboard.mission_ongoing')); return; }
    if (st !== 'ACCEPTED') return;

    let cancelled = false;
    const fetchETA = async () => {
      try {
        const details = await api.get(`/requests/${activeMission.id}`);
        const req = details?.data || details;
        const provider = req?.provider;
        if (!provider?.lat || !provider?.lng || !req?.lat || !req?.lng) {
          if (!cancelled) setHasLiveGps(false);
          setEtaLabel(t('dashboard.provider_on_way'));
          return;
        }
        if (!cancelled) setHasLiveGps(true);
        if (GOOGLE_MAPS_API_KEY) {
          const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${provider.lat},${provider.lng}&destination=${req.lat},${req.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
          if (!cancelled && data.status === 'OK' && data.routes?.length > 0) {
            const match = data.routes[0].legs[0].duration.text.match(/(\d+)/);
            const min = match ? parseInt(match[1]) : null;
            setEtaLabel(min !== null && min <= 1 ? t('dashboard.arrival_imminent') : t('dashboard.arrival_in_min', { min }));
            return;
          }
        }
        const R = 6371;
        const dLat = (req.lat - provider.lat) * Math.PI / 180;
        const dLon = (req.lng - provider.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(provider.lat * Math.PI / 180) * Math.cos(req.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const min = Math.ceil((dist * 1.4 / 30) * 60);
        if (!cancelled) setEtaLabel(min <= 1 ? t('dashboard.arrival_imminent') : t('dashboard.arrival_in_min', { min }));
      } catch {
        if (!cancelled) { setHasLiveGps(false); setEtaLabel(t('dashboard.provider_on_way')); }
      }
    };
    fetchETA();
    const iv = setInterval(fetchETA, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [activeMission?.id, activeMission?.status]);


  // ── ACCEPTED / ONGOING — HERO mission island (ETA dominant)
  if (activeMission) {
    const isOngoing = activeMission.status.toUpperCase() === 'ONGOING';
    // Extract ETA minutes from etaLabel (e.g. "Arrivée dans 21 min" → "21")
    const etaMinMatch = etaLabel.match(/(\d+)/);
    const etaMin = etaMinMatch ? etaMinMatch[1] : null;

    return (
      <TouchableOpacity accessibilityRole="button"
        onPress={onActiveMissionPress}
        activeOpacity={PRESS_PRIMARY}
      >
        <View style={{ padding: 20 }}>
          {/* Status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <FixedStatusChip status="ONGOING" label={isOngoing ? t('dashboard.status_ongoing').toUpperCase() : t('dashboard.provider_on_way').toUpperCase()} />
            {hasLiveGps ? (
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.heroSubFaint, letterSpacing: 0.8 }}>
                LIVE · GPS
              </Text>
            ) : null}
          </View>

          {/* ETA — the star of the show */}
          {!isOngoing && etaMin ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 56, color: theme.heroText, lineHeight: 56 }}>
                {etaMin}
              </Text>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: theme.heroSub, letterSpacing: 0.5 }}>
                MIN
              </Text>
            </View>
          ) : null}

          {/* Service name */}
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, color: theme.heroText, letterSpacing: 0.4 }} numberOfLines={1}>
            {(translateRequestServiceRaw(activeMission as any) || activeMission.title || activeMission.serviceType || '').toUpperCase()}
          </Text>

          {/* Address */}
          {activeMission.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Feather name="map-pin" size={12} color={theme.heroSub} />
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub }} numberOfLines={1}>
                {activeMission.address}
              </Text>
            </View>
          ) : null}

          {/* Provider row */}
          {activeMission.provider && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              marginTop: 16, paddingTop: 16,
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
            }}>
              <FixedAvatar
                name={cleanName(activeMission.provider.name, { fallback: 'P' })}
                avatarUrl={activeMission.provider.avatarUrl}
                size={40}
                verified
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.heroText }}>
                  {cleanName(activeMission.provider.name)}
                </Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: theme.heroSub }}>
                  {t('dashboard.provider_on_way')}
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: COLORS.greenBrand,
                  alignItems: 'center', justifyContent: 'center',
                }}
                onPress={(e) => { e.stopPropagation?.(); hapticLight(); onCallProvider?.(); }}
                accessibilityRole="button"
                accessibilityLabel="Appeler le prestataire"
                activeOpacity={0.85}
              >
                <Feather name="phone" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                  alignItems: 'center', justifyContent: 'center',
                }}
                onPress={(e) => { e.stopPropagation?.(); hapticLight(); onMessageProvider?.(); }}
                accessibilityRole="button"
                accessibilityLabel="Envoyer un message au prestataire"
                activeOpacity={0.85}
              >
                <Feather name="message-square" size={18} color={theme.heroText} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // ── PUBLISHED — searching (même gabarit que active)
  if (searchingMission) {
    return (
      <TouchableOpacity accessibilityRole="button" onPress={onSearchingPress} activeOpacity={PRESS_PRIMARY}>
        <View style={{ padding: 20 }}>
          {/* Status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <FixedStatusChip status="SEARCHING" label={t('dashboard.search_in_progress').toUpperCase()} />
            <SearchCountdown key={searchingMission.id} expiresAt={searchingMission.expiresAt ?? null} fallback={SEARCH_TIMEOUT} color={theme.heroSubFaint as string} />
          </View>

          {/* Service name — hero */}
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, color: theme.heroText, letterSpacing: 0.4, marginBottom: 4 }} numberOfLines={1}>
            {(translateRequestServiceRaw(searchingMission as any) || searchingMission.title || searchingMission.serviceType || '').toUpperCase()}
          </Text>

          {/* Address */}
          {searchingMission.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Feather name="map-pin" size={12} color={theme.heroSub} />
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub }} numberOfLines={1}>
                {searchingMission.address}
              </Text>
            </View>
          ) : null}

          {/* Searching indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
            <PulseDot size={8} color={COLORS.amber} />
            <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.heroSub, flex: 1 }}>
              {t('dashboard.searching_best_provider')}
            </Text>
            <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.heroSubFaint, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="arrow-right" size={14} color={theme.heroSub} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── QUOTE_PENDING / QUOTE_SENT — devis (même gabarit)
  if (quoteMission && onQuotePress) {
    const isQuoteSent = quoteMission.status?.toUpperCase() === 'QUOTE_SENT';
    return (
      <TouchableOpacity accessibilityRole="button" onPress={onQuotePress} activeOpacity={PRESS_PRIMARY}>
        <View style={{ padding: 20 }}>
          {/* Status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <FixedStatusChip status={isQuoteSent ? 'QUOTE_SENT' : 'QUOTE_PENDING'} label={isQuoteSent ? t('dashboard.status_quote_sent').toUpperCase() : t('dashboard.status_quote_pending').toUpperCase()} />
            <Feather name="file-text" size={14} color={theme.heroSubFaint} />
          </View>

          {/* Service name — hero */}
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, color: theme.heroText, letterSpacing: 0.4, marginBottom: 4 }} numberOfLines={1}>
            {(translateRequestServiceRaw(quoteMission as any) || quoteMission.title || quoteMission.serviceType || '').toUpperCase()}
          </Text>

          {/* Address */}
          {quoteMission.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Feather name="map-pin" size={12} color={theme.heroSub} />
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub }} numberOfLines={1}>
                {quoteMission.address}
              </Text>
            </View>
          ) : null}

          {/* Action hint */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
            <PulseDot size={8} color={isQuoteSent ? COLORS.green : COLORS.amber} />
            <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.heroSub, flex: 1 }}>
              {isQuoteSent ? t('dashboard.quote_action_review') : t('dashboard.quote_action_waiting')}
            </Text>
            <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.heroSubFaint, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="arrow-right" size={14} color={theme.heroSub} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Empty — no active mission (parent shows "Besoin d'un pro?" instead)
  return null;
}


// ============================================================================
// ACTIVITY ITEM — recent request row
// ============================================================================

function ActivityItem({
  request,
  onPress,
  isLast,
  theme,
}: {
  request: DashboardData['requests'][0];
  onPress: () => void;
  isLast: boolean;
  theme: AppTheme;
}) {
  const { t, i18n } = useTranslation();
  const localeMap: Record<string, string> = { fr: 'fr-FR', nl: 'nl-BE', en: 'en-GB' };
  const locale = localeMap[i18n.language] || 'fr-FR';
  const status = getStatusInfo(request.status, t);
  // Affiche le nom localisé : subcategory.nameI18n[lang] (via translateRequestService),
  // sinon traduit le slug de la catégorie. serviceType reste un fallback ultime mais
  // c'est une snapshot FR au moment de la création — à n'utiliser que si rien d'autre.
  const serviceName =
    translateRequestServiceRaw(request as any) ||
    translateCategoryRaw(request.category as any) ||
    request.title ||
    request.serviceType ||
    '';
  const icon = getServiceIcon(serviceName);
  const date = new Date(request.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const statusKey = request.status?.toUpperCase();
  let badgeBg = theme.badgeDoneBg;
  let badgeTextColor = theme.badgeDoneText;
  if (statusKey === 'CANCELLED' || statusKey === 'EXPIRED') {
    badgeBg = theme.badgeCancelledBg;
    badgeTextColor = theme.badgeCancelledText;
  } else if (['PUBLISHED', 'PENDING', 'PENDING_PAYMENT', 'ACCEPTED', 'ONGOING', 'QUOTE_PENDING'].includes(statusKey || '')) {
    badgeBg = theme.badgePendingBg;
    badgeTextColor = theme.badgePendingText;
  }

  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={PRESS_PRIMARY} style={{ marginBottom: 8 }}>
      <FixedCard pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={icon as any} size={18} color={theme.textSub} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13.5, color: theme.text }} numberOfLines={1}>
              {serviceName || t('common.service')}
            </Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.textMuted, letterSpacing: 0.6, marginTop: 2 }}>
              {date.toUpperCase()} · FIXED #{String(request.id).slice(-4)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {request.price ? (
              <FixedPrice amount={request.price} size={22} color={theme.text} />
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: badgeBg, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: badgeTextColor }} />
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: badgeTextColor, letterSpacing: 0.5 }}>{status.label}</Text>
            </View>
          </View>
        </View>
      </FixedCard>
    </TouchableOpacity>
  );
}


// ============================================================================
// UPCOMING ISLAND CARD — demande planifiée future
// Même layout que MissionIsland.active, mais outlined (pas filled) pour marquer
// que la demande n'est pas encore active — juste planifiée pour plus tard.
// ============================================================================

// Live countdown: "2J 14H", "3H 45M", "45M", "< 1M"
function useCountdown(targetDate: Date | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetDate) return;
    const iv = setInterval(() => setNow(Date.now()), 60_000); // tick every minute
    return () => clearInterval(iv);
  }, [targetDate]);

  if (!targetDate) return { label: '', fraction: 0 };
  const diff = Math.max(0, targetDate.getTime() - now);
  const totalMin = Math.floor(diff / 60_000);
  const h = Math.floor(totalMin / 60);
  const d = Math.floor(h / 24);
  const m = totalMin % 60;

  let label: string;
  if (d >= 1) label = `${d}J ${h % 24}H`;
  else if (h >= 1) label = `${h}H ${String(m).padStart(2, '0')}M`;
  else if (totalMin >= 1) label = `${totalMin}M`;
  else label = '< 1M';

  // fraction 0→1 based on 48h window (visual only, clamps)
  const maxWindow = 48 * 60 * 60 * 1000;
  const fraction = Math.min(1, Math.max(0, diff / maxWindow));
  return { label, fraction };
}

function UpcomingIslandCard({
  request,
  onPress,
  theme,
}: {
  request: DashboardData['requests'][0];
  onPress: () => void;
  theme: AppTheme;
}) {
  const { t, i18n } = useTranslation();
  const localeMap: Record<string, string> = { fr: 'fr-FR', nl: 'nl-BE', en: 'en-GB' };
  const locale = localeMap[i18n.language] || 'fr-FR';
  const serviceName =
    translateRequestServiceRaw(request as any) ||
    translateCategoryRaw(request.category as any) ||
    request.title ||
    request.serviceType ||
    '';
  const isQuote = request.pricingMode === 'estimate' || request.pricingMode === 'diagnostic';
  const statusUp = (request.status || '').toUpperCase();
  const isAccepted = statusUp === 'ACCEPTED';
  // Paiement jamais finalisé (PaymentSheet abandonnée) : la demande n'est PAS
  // visible des prestataires — l'état doit être explicite avant même le tap.
  const isPendingPayment = statusUp === 'PENDING_PAYMENT';

  const scheduledDate = request.preferredTimeStart ? new Date(request.preferredTimeStart) : null;
  const { label: countdownLabel, fraction } = useCountdown(scheduledDate);

  // Date label: "Demain · 09:00" or "Mer 8 avr · 10:00"
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow = scheduledDate && scheduledDate.getDate() === tomorrow.getDate() &&
                     scheduledDate.getMonth() === tomorrow.getMonth() &&
                     scheduledDate.getFullYear() === tomorrow.getFullYear();
  const dayLabel = scheduledDate
    ? (isTomorrow
        ? t('dashboard.tomorrow')
        : scheduledDate.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }))
    : '';
  const timeLabel = scheduledDate
    ? scheduledDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '';

  // Progress bar color: green if accepted, warm accent if waiting
  const barColor = isAccepted ? COLORS.greenBrand : (theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)');
  const barTrack = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <TouchableOpacity accessibilityRole="button"
      style={[uc.card, {
        backgroundColor: theme.cardBg,
        borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }]}
      onPress={onPress}
      activeOpacity={PRESS_PRIMARY}
    >
      {/* Top row: service name + countdown */}
      <View style={uc.topRow}>
        <View style={uc.topLeft}>
          {/* Badge paiement en attente/devis/planifiée */}
          <View style={[uc.typeBadge, (isPendingPayment || isQuote)
            ? { backgroundColor: 'rgba(232,168,56,0.10)' }
            : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
          ]}>
            <Text style={[uc.typeLabel, { color: (isPendingPayment || isQuote) ? COLORS.amber : theme.textMuted }]}>
              {isPendingPayment ? t('dashboard.badge_payment_pending') : isQuote ? t('dashboard.badge_quote') : t('dashboard.badge_scheduled')}
            </Text>
          </View>
          <Text style={[uc.serviceName, { color: theme.text }]} numberOfLines={1}>
            {serviceName}
          </Text>
        </View>
        {/* Countdown block */}
        <View style={uc.countdownWrap}>
          <Text style={[uc.countdownValue, { color: theme.text }]}>{countdownLabel}</Text>
        </View>
      </View>

      {/* Progress bar (diminishes as time approaches) */}
      <View style={[uc.progressTrack, { backgroundColor: barTrack }]}>
        <View style={[uc.progressFill, { backgroundColor: barColor, width: `${Math.max(2, fraction * 100)}%` }]} />
      </View>

      {/* Bottom row: date + status */}
      <View style={uc.bottomRow}>
        <View style={uc.dateRow}>
          <Feather name="calendar" size={13} color={theme.textMuted} />
          <Text style={[uc.dateText, { color: theme.textSub }]}>
            {dayLabel}{timeLabel ? ` · ${timeLabel}` : ''}
          </Text>
        </View>
        {isPendingPayment ? (
          <View style={uc.statusBadge}>
            <View style={[uc.statusDot, { backgroundColor: COLORS.amber }]} />
            <Text style={[uc.statusText, { color: COLORS.amber }]}>{t('dashboard.resume_payment')}</Text>
          </View>
        ) : isAccepted ? (
          <View style={uc.statusBadge}>
            <View style={[uc.statusDot, { backgroundColor: COLORS.greenBrand }]} />
            <Text style={[uc.statusText, { color: theme.greenText }]} numberOfLines={1}>
              {request.provider?.name ? cleanName(request.provider.name) : t('dashboard.confirmed')}
            </Text>
          </View>
        ) : (
          <View style={uc.statusBadge}>
            <View style={[uc.statusDot, { backgroundColor: theme.textMuted as string }]} />
            <Text style={[uc.statusText, { color: theme.textMuted }]}>{t('dashboard.status_pending')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const uc = StyleSheet.create({
  card: {
    borderRadius: 18, borderWidth: 1,
    padding: 16, gap: 14,
  },

  // Top
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  topLeft: { flex: 1, gap: 6 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  typeLabel: { fontFamily: FONTS.sansMedium, fontSize: 10, letterSpacing: 1.5 },
  serviceName: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, letterSpacing: 0.3, lineHeight: 25 },

  // Countdown
  countdownWrap: { alignItems: 'flex-end', justifyContent: 'center', paddingTop: 2 },
  countdownValue: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 28, letterSpacing: 1, lineHeight: 30 },

  // Progress bar
  progressTrack: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 1.5 },

  // Bottom
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontFamily: FONTS.sans, fontSize: 13 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, marginRight: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: FONTS.sansMedium, fontSize: 12, flexShrink: 1 },
});

// ============================================================================
// SKELETON — shown during cold load instead of a blank spinner
// Mirrors the shell of the real dashboard (topbar, runway, CTA, island, list)
// with a subtle pulse so the layout doesn't reflow when data arrives.
// ============================================================================

function DashboardSkeleton({ theme }: { theme: AppTheme }) {
  // Moment 18 : les blocs respirent (composant partagé) ; le contenu réel
  // arrive ensuite en cascade dans la même géométrie.
  const Block = ({ w, h, style }: { w: number | `${number}%`; h: number; style?: object }) => (
    <Skeleton w={w} h={h} style={style} />
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={{ paddingBottom: 32 }}>
        {/* Topbar */}
        <View style={s.topbar}>
          <View>
            <Block w={100} h={10} style={{ marginBottom: 8 }} />
            <Block w={160} h={28} />
          </View>
          <View style={s.topbarActions}>
            <Block w={36} h={36} style={{ borderRadius: 10 }} />
            <Block w={36} h={36} style={{ borderRadius: 10 }} />
          </View>
        </View>

        {/* Hero CTA */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Block w="100%" h={200} style={{ borderRadius: 20 }} />
        </View>

        {/* Mission island */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={80} h={10} />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <Block w="100%" h={70} style={{ borderRadius: 12 }} />
        </View>

        {/* Services grid */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={70} h={10} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10 }}>
          <Block w="48%" h={100} style={{ borderRadius: 18 }} />
          <Block w="48%" h={100} style={{ borderRadius: 18 }} />
        </View>

        {/* Activity */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={100} h={10} />
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Volontairement très limité côté dashboard : 3 par défaut, 6 au max après "Voir plus".
// L'historique complet vit dans /missions ou /documents pour ne pas faire concurrence.
const PREVIEW_COUNT = 3;
const EXPANDED_COUNT = 6;

// L'onglet Accueil : l'accueil prestataire pour un prestataire (une seule
// instance dans toute l'app), l'accueil client sinon — sans monter les hooks
// de l'un pour l'autre.
export default function Dashboard() {
  const { user } = useAuth();
  const isProvider = !!user?.roles?.includes('PROVIDER');
  return isProvider ? <ProviderDashboard /> : <ClientDashboard />;
}

function ClientDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { socket, unreadCount, unreadMessages } = useSocket();
  const callParty = useCallParty();
  const theme = useAppTheme();
  const { width: windowWidth, height: windowHeight } = useLayoutClass();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const tabBarPadding = useTabBarPadding();
  const brandRefresh = useBrandRefresh();

  // CTA — retour à l'appui (règle 4), amortissement critique, aucun rebond.
  const ctaPress = usePressScale();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const sheetMotion = useSheetMotion();
  // Sheet détail montée UNIQUEMENT quand ouverte : toujours montée avec
  // index={-1} + enableDynamicSizing, gorhom l'auto-ouvre sur Android et son
  // backdrop plein écran bloque tous les touchs. Le state contrôle le montage
  // et sert aussi au bouton back Android.
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const closeDetailSheet = useCallback(() => { bottomSheetRef.current?.close(); }, []);
  useAndroidBackClose(detailSheetOpen, closeDetailSheet);

  const invoiceRequestId = selectedRequest?.status?.toUpperCase() === 'DONE' ? selectedRequest?.id : null;
  const { invoice } = useInvoice(invoiceRequestId ? Number(invoiceRequestId) : null);

  // ── Data ──
  const loadDashboard = useCallback(async () => {
    try {
      const response = await api.get('/client/dashboard');
      setData(response.data || response);
      setLoadError(false);
    } catch (error) {
      devError('Dashboard load error:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const lastFetchRef = useRef(0);
  // Persist accepted-request deduplication across socket re-registrations so
  // we don't double-navigate on reconnect. Module-local would bleed across
  // users, so it's scoped per Dashboard mount via useRef.
  const acceptedIdsRef = useRef<Set<string>>(new Set());
  // Vrai tant que l'accueil est l'écran affiché (voir handleAccepted).
  const isFocusedRef = useRef(false);
  useFocusEffect(useCallback(() => {
    isFocusedRef.current = true;
    return () => { isFocusedRef.current = false; };
  }, []));

  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 60_000) { // 60s cache — socket handles real-time updates
      lastFetchRef.current = now;
      const task = runWhenIdle(() => loadDashboard());
      return () => task.cancel();
    }
  }, [loadDashboard]));
  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  // ── Navigation ──
  const navigateToMissionView = useCallback((request: any) => {
    const r = request;
    const scheduledFor = r.scheduledFor || r.preferredTimeStart;
    router.replace({
      pathname: '/request/[id]/missionview',
      params: {
        id:             String(r.id),
        serviceName:    r.title || r.serviceType || r.name || '',
        address:        r.address || '',
        price:          String(r.price || ''),
        scheduledLabel: scheduledFor
          ? new Date(scheduledFor).toLocaleString(({ fr: 'fr-FR', nl: 'nl-BE', en: 'en-GB' } as Record<string,string>)[i18n.language] || 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : t('common.now'),
        expiresAt: r.expiresAt || '',
        lat: String(r.lat || ''),
        lng: String(r.lng || ''),
      },
    });
  }, [router]);

  const navigateToSearching = useCallback((request: any) => {
    navigateToMissionView(request);
  }, [navigateToMissionView]);

  // ── Socket ──
  useEffect(() => {
    if (!socket || !user?.id) return;
    // Note: user room join is handled server-side on socket connection (server.js)
    // No need to emit join:user from client — avoids leave/join spam on re-render

    const updateRequestStatus = (requestId: string | number, newStatus: string) => {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          requests: prev.requests.map(r =>
            String(r.id) === String(requestId) ? { ...r, status: newStatus } : r
          ),
        };
      });
    };

    const handleAccepted = (d: any) => {
      const reqId = String(d.id || d.requestId);
      if (acceptedIdsRef.current.has(reqId)) return;
      if (d.clientId && d.clientId !== user?.id) return;
      acceptedIdsRef.current.add(reqId);
      updateRequestStatus(reqId, 'ACCEPTED');
      // Le suivi (missionview) joue lui-même la bascule « accepté » sur sa
      // carte : on ne navigue que si l'accueil est l'écran affiché, sinon on
      // remonterait l'écran de suivi sous les pieds du client.
      if (!isFocusedRef.current) return;
      if (reqId) {
        api.get(`/requests/${reqId}`)
          .then(res => {
            const req = res?.data || res;
            // Scheduled future mission → recap screen, not missionview
            const pts = req.preferredTimeStart;
            if (pts && new Date(pts).getTime() > Date.now()) {
              router.replace({
                pathname: '/request/[id]/scheduled',
                params: { id: reqId, mode: 'recap' },
              });
            } else {
              navigateToMissionView(req);
            }
          })
          .catch(() => {
            router.replace({
              pathname: '/request/[id]/missionview',
              params: { id: reqId },
            });
          });
      }
    };
    const handleStarted       = (d: any) => { updateRequestStatus(d.id || d.requestId, 'ONGOING'); };
    const handleCompleted     = (d: any) => { updateRequestStatus(d.id || d.requestId, 'DONE');      loadDashboard(); };
    const handleCancelled     = (d: any) => { updateRequestStatus(d.id || d.requestId, 'CANCELLED'); loadDashboard(); };
    const handleExpired       = (d: any) => { updateRequestStatus(d.id || d.requestId, 'EXPIRED');   loadDashboard(); };
    const handlePublished     = (d: any) => { updateRequestStatus(d.requestId, 'PUBLISHED'); };
    const handleStatusUpdated = (d: any) => { updateRequestStatus(d.requestId, d.status);   loadDashboard(); };

    socket.on('request:accepted',      handleAccepted);
    socket.on('request:started',       handleStarted);
    socket.on('request:completed',     handleCompleted);
    socket.on('request:cancelled',     handleCancelled);
    socket.on('request:expired',       handleExpired);
    socket.on('request:published',     handlePublished);
    socket.on('request:statusUpdated', handleStatusUpdated);
    socket.on('provider:accepted',     handleAccepted);

    return () => {
      socket.off('request:accepted',      handleAccepted);
      socket.off('request:started',       handleStarted);
      socket.off('request:completed',     handleCompleted);
      socket.off('request:cancelled',     handleCancelled);
      socket.off('request:expired',       handleExpired);
      socket.off('request:published',     handlePublished);
      socket.off('request:statusUpdated', handleStatusUpdated);
      socket.off('provider:accepted',     handleAccepted);
    };
  }, [socket, user?.id, router, loadDashboard, navigateToMissionView]);

  // ── Actions ──
  const handleRequestPress = async (requestId: string) => {
    const localReq = data?.requests?.find(r => String(r.id) === String(requestId));
    if (localReq?.status?.toUpperCase() === 'PUBLISHED') {
      navigateToSearching(localReq);
      return;
    }
    if (localReq && ['ACCEPTED', 'ONGOING'].includes(localReq.status?.toUpperCase())) {
      navigateToMissionView(localReq);
      return;
    }
    setLoadingDetails(true);
    setDetailSheetOpen(true);
    try {
      const details = await api.get(`/requests/${requestId}`);
      const req = details.request || details.data || details;
      if (req?.status?.toUpperCase() === 'PUBLISHED') {
        bottomSheetRef.current?.close();
        navigateToSearching(req);
        return;
      }
      if (['ACCEPTED', 'ONGOING'].includes(req?.status?.toUpperCase())) {
        bottomSheetRef.current?.close();
        navigateToMissionView(req);
        return;
      }
      setSelectedRequest(req);
    } catch (error) {
      devError('Error loading request details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleNavigateToMission = useCallback((request: any) => {
    bottomSheetRef.current?.close();
    navigateToMissionView(request);
  }, [navigateToMissionView]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.3} />
    ), []
  );

  // Missions "actives maintenant" : ACCEPTED/ONGOING MAIS pas planifiées pour plus tard.
  // Une mission ACCEPTED avec preferredTimeStart dans le futur = engagement d'un
  // prestataire sur une date future → reste dans "À venir" jusqu'au jour J.
  const activeMission = useMemo(() =>
    data?.requests?.find(r =>
      ['ACCEPTED', 'ONGOING'].includes(r.status?.toUpperCase()) &&
      !isScheduledFuture(r)
    ) || null,
    [data]
  );

  // PUBLISHED "maintenant" uniquement — exclut les demandes planifiées futures
  // qui vont dans la section "À venir" séparée.
  const searchingMission = useMemo(
    () => activeMission ? null : (data?.requests?.find(r =>
      r.status?.toUpperCase() === 'PUBLISHED' && !isScheduledFuture(r)
    ) || null),
    [data, activeMission]
  );

  // Devis "maintenant" uniquement — exclut les devis planifiés futurs.
  const quoteMission = useMemo(
    () => (activeMission || searchingMission) ? null : (data?.requests?.find(r =>
      ['QUOTE_PENDING', 'QUOTE_SENT'].includes(r.status?.toUpperCase()) && !isScheduledFuture(r)
    ) || null),
    [data, activeMission, searchingMission]
  );

  const HIDDEN_STATUSES = ['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED'];
  const DOCUMENT_STATUSES = ['QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];

  // Activités récentes : exclut les HIDDEN, les devis (→ tab Documents), et les scheduled futurs (→ section À venir)
  const activityRequests = useMemo(
    () => (data?.requests || []).filter(r =>
      !HIDDEN_STATUSES.includes(r.status?.toUpperCase()) &&
      !DOCUMENT_STATUSES.includes(r.status?.toUpperCase()) &&
      !isScheduledFuture(r)
    ),
    [data]
  );

  // Section "À venir" : demandes planifiées dans le futur, triées par date croissante
  const upcomingRequests = useMemo(
    () => (data?.requests || [])
      .filter(r => isScheduledFuture(r))
      .filter(r => !['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED', 'DONE'].includes(r.status?.toUpperCase()))
      .sort((a, b) =>
        new Date(a.preferredTimeStart!).getTime() - new Date(b.preferredTimeStart!).getTime()
      ),
    [data]
  );

  const displayedRequests = useMemo(() => {
    // Cap à EXPANDED_COUNT même quand "Voir plus" est cliqué — l'historique
    // complet est accessible depuis l'onglet Missions / Documents.
    const limit = showAllRequests ? EXPANDED_COUNT : PREVIEW_COUNT;
    return activityRequests.slice(0, limit);
  }, [activityRequests, showAllRequests]);

  const totalCount = activityRequests.length;
  const hasMore = totalCount > PREVIEW_COUNT;

  // ── Le disque de la barre flottante : « + » au repos, la flèche quand une demande vit ──
  // Réglé ici, rendu par la barre, il suit sur Documents et Profil.
  const setDisc = useNavStore((st) => st.setDisc);
  const liveMission = activeMission || searchingMission;
  const liveMissionId = liveMission?.id ?? null;
  useEffect(() => {
    const kind = clientDisc(!!liveMission);
    setDisc({
      kind,
      label: kind === 'track' ? t('dashboard.track_mission') : t('dashboard.new_request'),
      onPress: kind === 'track' ? () => { if (liveMission) navigateToMissionView(liveMission); } : () => router.push('/request/NewRequestStepper'),
    });
  }, [liveMissionId, liveMission?.status, liveMission, t, setDisc, navigateToMissionView, router]);
  useEffect(() => () => setDisc({ kind: 'hidden' }), [setDisc]);

  // Skeleton shell during cold load — prevents layout reflow when data lands
  if (loading && !refreshing && !data) {
    return <DashboardSkeleton theme={theme} />;
  }

  const name = cleanName(data?.me?.name, { email: user?.email, fallback: '' });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Moment 17 : le « fixed. » s'étire avec le tirage ; le RefreshControl natif garde le déclenchement. */}
      <BrandRefreshHeader style={brandRefresh.headerStyle} />
      <Reanimated.ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: tabBarPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />}
        showsVerticalScrollIndicator={false}
        onScroll={brandRefresh.onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Bannière d'erreur réseau + retry ── */}
        {loadError && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            marginHorizontal: 16, marginTop: 8, marginBottom: 4,
            borderRadius: 12, padding: 12, backgroundColor: theme.surface,
          }}>
            <Feather name="alert-circle" size={15} color={theme.text} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: FONTS.sans, color: theme.text }}>
              Impossible de charger vos données.
            </Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => { hapticLight(); loadDashboard(); }}>
              <Text style={{ fontSize: 13, fontFamily: FONTS.sansMedium, color: theme.text }}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* ══════════════════════════════════════════════════════════════
            ADAPTIVE TOP: État A (idle) vs État B (mission active)
            Quand une mission est active, elle ÉCRASE le hero.
            ══════════════════════════════════════════════════════════════ */}

        {/* ── TOP BAR — always visible, compact ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: (activeMission || searchingMission || quoteMission) ? 12 : 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.textMuted, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 4 }}>
                {data?.me?.city?.toUpperCase() || t('profile.default_city').toUpperCase()}
              </Text>
              <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: (activeMission || searchingMission || quoteMission) ? 22 : 28, color: theme.text, letterSpacing: 0.4 }}>
                {`${getGreeting(t)}, ${name.split(' ')[0]}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <FixedIconBtn icon="bell" accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'} badge={unreadCount > 0} onPress={() => { hapticLight(); router.push('/notifications'); }} />
              <FixedIconBtn icon="message-square" accessibilityLabel={unreadMessages > 0 ? `Messages, ${unreadMessages} non lus` : 'Messages'} badge={unreadMessages > 0} onPress={() => { hapticLight(); router.push('/messages'); }} />
            </View>
          </View>
        </View>

        {/* ── ÎLOT NOIR — un seul bloc, deux états ── */}
        <CascadeItem index={0} stepMs={50}>
        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
          <View style={{
            backgroundColor: theme.heroBg, borderRadius: 24, overflow: 'hidden',
            borderWidth: theme.isDark ? 1 : 0, borderColor: theme.borderLight,
          }}>
            {(activeMission || searchingMission || quoteMission) ? (
              /* ── État actif : mission en cours ── */
              <MissionIsland
                activeMission={activeMission}
                searchingMission={searchingMission}
                quoteMission={quoteMission}
                onActiveMissionPress={() => {
                  if (!activeMission) return;
                  hapticLight();
                  navigateToMissionView(activeMission);
                }}
                onSearchingPress={() => {
                  if (!searchingMission) return;
                  hapticLight();
                  navigateToSearching(searchingMission);
                }}
                onQuotePress={() => {
                  if (!quoteMission) return;
                  hapticLight();
                  const st = quoteMission.status?.toUpperCase();
                  if (st === 'QUOTE_SENT') {
                    router.push({ pathname: '/request/[id]/quote-review', params: { id: String(quoteMission.id) } });
                  } else {
                    router.push({ pathname: '/request/[id]/missionview', params: { id: String(quoteMission.id) } });
                  }
                }}
                onCallProvider={() => {
                  const provider = activeMission?.provider;
                  if (!provider) return;
                  // provider.id est l'id Provider, pas un userId : on n'appelle que le userId.
                  callParty({ userId: (provider as any).userId, name: provider.name, requestId: activeMission.id });
                }}
                onMessageProvider={() => {
                  const provider = activeMission?.provider;
                  if (!provider) return;
                  const providerUserId = (provider as any).userId || provider.id;
                  if (!providerUserId) return;
                  router.push({
                    pathname: '/messages/[userId]',
                    params: {
                      userId: String(providerUserId),
                      name: provider.name || '',
                      requestId: String(activeMission.id),
                    },
                  });
                }}
                theme={theme}
              />
            ) : (
              /* ── État idle : "Besoin d'un pro ?" ── */
              <View style={{ padding: 22 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.heroSubFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  {t('dashboard.available_24_7')}
                </Text>
                <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 30, color: theme.heroText, letterSpacing: 0.4, marginBottom: 20, lineHeight: 32 }}>
                  {t('dashboard.hero_title')}
                </Text>
                <Pressable
                  {...ctaPress.handlers}
                  onPress={() => { hapticMedium(); router.push('/request/NewRequestStepper'); }}
                >
                  {/* CTA pill blanche pleine — signature du kit fixed-design (hero island) */}
                  <Reanimated.View style={[{
                    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8,
                    borderRadius: 100, paddingVertical: 11, paddingHorizontal: 18,
                    backgroundColor: '#F4F4F2',
                  }, ctaPress.style]}>
                    <Feather name="plus" size={17} color="#0A0A0A" />
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: '#0A0A0A' }}>
                      {t('dashboard.new_request')}
                    </Text>
                  </Reanimated.View>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        </CascadeItem>
        {/* ── À VENIR (demandes planifiées futures) ── */}
        <CascadeItem index={1} stepMs={50}>
        {upcomingRequests.length > 0 && (
          <>
            <View style={{ marginTop: 22 }}>
              <FixedSectionHeader label={t('dashboard.upcoming')} action={String(upcomingRequests.length)} />
            </View>
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {upcomingRequests.map((req) => (
                <UpcomingIslandCard
                  key={req.id}
                  request={req}
                  theme={theme}
                  onPress={() => {
                    hapticLight();
                    // Routage par état (même règle que documents.tsx) :
                    // paiement jamais finalisé → reprise du paiement, pas le récap
                    // qui laisserait croire que la demande est visible des prestataires.
                    router.push(req.status?.toUpperCase() === 'PENDING_PAYMENT'
                      ? { pathname: '/request/[id]/resume-payment', params: { id: String(req.id) } }
                      : { pathname: '/request/[id]/scheduled', params: { id: String(req.id), mode: 'recap' } });
                  }}
                />
              ))}
            </View>
          </>
        )}

        </CascadeItem>
        {/* ── POPULAR SERVICES (2x2 grid) ── */}
        <CascadeItem index={2} stepMs={50}>
        <View style={{ marginTop: 26 }}>
          <FixedSectionHeader label={t('dashboard.services_available').toUpperCase()} />
        </View>
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {LAUNCH_CARDS.map((card) => (
            <TouchableOpacity accessibilityRole="button"
              key={card.key}
              onPress={() => {
                hapticMedium();
                router.push(`/request/NewRequestStepper?selectedCategory=${card.category}`);
              }}
              activeOpacity={PRESS_PRIMARY}
              style={{ width: (windowWidth - 42) / 2 }}
            >
              <FixedCard pad={14}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Feather name={card.icon as any} size={18} color={theme.text} />
                </View>
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.text }}>{t(`category.${card.key}`, { defaultValue: card.key })}</Text>
              </FixedCard>
            </TouchableOpacity>
          ))}
        </View>

        </CascadeItem>
        {/* ── ACTIVITÉ RÉCENTE ── */}
        <View style={{ marginTop: 26 }}>
          <FixedSectionHeader label={t('dashboard.recent_activity').toUpperCase()} action={totalCount ? String(totalCount) : undefined} onAction={() => { hapticLight(); onRefresh(); }} />
        </View>

        <View style={s.activityList}>
          {!data?.requests?.length ? (
            <View style={s.emptyActivity}>
              <View style={[s.emptyActivityIcon, { backgroundColor: theme.surface }]}>
                <Feather name="file-text" size={22} color={theme.textDisabled} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>{t('dashboard.no_missions')}</Text>
              <Text style={[s.emptySub, { color: theme.textMuted }]}>{t('dashboard.missions_appear_here')}</Text>
            </View>
          ) : (
            <>
              {displayedRequests.map((req, i) => (
                <ActivityItem
                  key={req.id}
                  request={req}
                  onPress={() => { hapticLight(); handleRequestPress(req.id); }}
                  isLast={i === displayedRequests.length - 1 && (!hasMore || showAllRequests)}
                  theme={theme}
                />
              ))}
            </>
          )}
        </View>

        {/* See all button */}
        {hasMore && (
          <TouchableOpacity accessibilityRole="button"
            style={s.seeAllBtn}
            onPress={() => { hapticLight(); setShowAllRequests(v => !v); }}
            activeOpacity={PRESS_SECONDARY}
          >
            <Text style={[s.seeAllText, { color: theme.textMuted }]}>
              {showAllRequests ? t('dashboard.collapse') : t('dashboard.see_more')}
            </Text>
            <Feather name={showAllRequests ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textMuted} />
          </TouchableOpacity>
        )}

      </Reanimated.ScrollView>

      {/* ── Bottom Sheet detail ── */}
      {detailSheetOpen && (
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        enableDynamicSizing
        enablePanDownToClose
        onClose={() => setDetailSheetOpen(false)}
        animationConfigs={sheetMotion.animationConfigs}
        overDragResistanceFactor={sheetMotion.overDragResistanceFactor}
        onAnimate={sheetMotion.onAnimate}
        backdropComponent={renderBackdrop}
        backgroundStyle={[s.sheetBg, { backgroundColor: theme.cardBg }]}
        handleIndicatorStyle={[s.sheetIndicator, { backgroundColor: theme.borderLight }]}
        maxDynamicContentSize={windowHeight * 0.85}
      >
        <BarLock />
        <BottomSheetScrollView contentContainerStyle={[s.sheet, { paddingBottom: tabBarPadding }]} showsVerticalScrollIndicator={false}>
          {loadingDetails ? (
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
          ) : selectedRequest ? (
            <>
              <Text style={[s.sheetTitle, { color: theme.text }]}>{translateRequestServiceRaw(selectedRequest)}</Text>

              <View style={[s.statusBadge, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                <PulseDot size={6} color={getStatusInfo(selectedRequest.status, t).ledColor} />
                <Text style={[s.statusBadgeText, { color: theme.textSub }]}>{getStatusInfo(selectedRequest.status, t).label}</Text>
              </View>

              {[
                { icon: 'file-text', val: selectedRequest.description || t('dashboard.no_description') },
                selectedRequest.address && { icon: 'map-pin', val: selectedRequest.address },
                selectedRequest.price    && { icon: 'dollar-sign', val: formatEUR(selectedRequest.price) },
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={s.sheetRow}>
                  <View style={[s.sheetRowIcon, { backgroundColor: theme.surface }]}>
                    <Feather name={row.icon} size={14} color={theme.textSub} />
                  </View>
                  <Text style={[s.sheetVal, { color: theme.textSub }]}>{row.val}</Text>
                </View>
              ))}

              {['ACCEPTED', 'ONGOING'].includes(selectedRequest.status?.toUpperCase()) && (
                <TouchableOpacity accessibilityRole="button" style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => handleNavigateToMission(selectedRequest)}>
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>
                    {selectedRequest.status === 'ACCEPTED' ? t('dashboard.track_provider') : t('dashboard.track_mission')}
                  </Text>
                  <Feather name="navigation" size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'PUBLISHED' && (
                <>
                  <TouchableOpacity accessibilityRole="button"
                    style={[s.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={() => {
                      bottomSheetRef.current?.close();
                      navigateToSearching(selectedRequest);
                    }}
                  >
                    <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.track_search')}</Text>
                    <Feather name="radio" size={17} color={theme.accentText} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button"
                    style={[s.resendBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
                    onPress={async () => {
                      try { await api.post(`/requests/${selectedRequest.id}/notify`); } catch {}
                    }}
                  >
                    <Feather name="refresh-cw" size={15} color={theme.textSub} />
                    <Text style={[s.resendText, { color: theme.textSub }]}>{t('dashboard.resend_providers')}</Text>
                  </TouchableOpacity>
                </>
              )}

              {selectedRequest.status?.toUpperCase() === 'DONE' && (
                <>
                  <View style={[s.doneCard, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                    <Feather name="check-circle" size={20} color={theme.greenText} />
                    <Text style={[s.doneText, { color: theme.text }]}>{t('dashboard.mission_success')}</Text>
                  </View>
                  {invoice && (
                    <TouchableOpacity accessibilityRole="button"
                      style={[s.actionBtn, { backgroundColor: theme.accent, marginTop: 10 }]}
                      onPress={() => {
                        bottomSheetRef.current?.close();
                        setTimeout(() => setInvoiceVisible(true), 300);
                      }}
                      activeOpacity={PRESS_PRIMARY}
                    >
                      <Feather name="file-text" size={17} color={theme.accentText} />
                      <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.view_invoice')}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {selectedRequest.status?.toUpperCase() === 'PENDING_PAYMENT' && (
                <TouchableOpacity accessibilityRole="button"
                  style={[s.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    bottomSheetRef.current?.close();
                    router.push({
                      pathname: '/request/[id]/resume-payment',
                      params: { id: String(selectedRequest.id) },
                    });
                  }}
                >
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.resume_payment')}</Text>
                  <Feather name="credit-card" size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {['QUOTE_PENDING', 'QUOTE_SENT'].includes(selectedRequest.status?.toUpperCase()) && (
                <TouchableOpacity accessibilityRole="button"
                  style={[s.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    bottomSheetRef.current?.close();
                    const path = selectedRequest.status?.toUpperCase() === 'QUOTE_SENT'
                      ? '/request/[id]/quote-review'
                      : '/request/[id]/missionview';
                    router.push({
                      pathname: path,
                      params: { id: String(selectedRequest.id) },
                    });
                  }}
                >
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>
                    {selectedRequest.status?.toUpperCase() === 'QUOTE_SENT' ? t('dashboard.view_quote') : t('dashboard.track_request')}
                  </Text>
                  <Feather name={selectedRequest.status?.toUpperCase() === 'QUOTE_SENT' ? 'file-text' : 'clock'} size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'QUOTE_ACCEPTED' && (
                <TouchableOpacity accessibilityRole="button"
                  style={[s.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => handleNavigateToMission(selectedRequest)}
                >
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.track_intervention')}</Text>
                  <Feather name="navigation" size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'EXPIRED' && (
                <>
                  <View style={[s.expiredCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.borderLight }]}>
                    <Feather name="clock" size={20} color={theme.textSub} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.expiredTitle, { color: theme.text }]}>{t('dashboard.no_provider_found')}</Text>
                      <Text style={[s.expiredSub, { color: theme.textMuted }]}>{t('dashboard.restart_search_sub')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity accessibilityRole="button" style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => { bottomSheetRef.current?.close(); router.push('/request/NewRequestStepper'); }}>
                    <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.restart_search')}</Text>
                    <Feather name="refresh-cw" size={17} color={theme.accentText} />
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheet>
      )}

      <InvoiceSheet
        invoice={invoice}
        isVisible={invoiceVisible}
        onClose={() => setInvoiceVisible(false)}
        userRole="client"
        providerName={selectedRequest?.provider?.name}
        serviceTitle={selectedRequest?.serviceType || selectedRequest?.title}
        missionDate={selectedRequest?.completedAt || selectedRequest?.createdAt}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 32 },

  // ── Top bar ──
  topbar: {
    paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14,
  },
  greeting: {
    fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.9,
    textTransform: 'uppercase', marginBottom: 6,
  },
  name: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 44, letterSpacing: 0.4 },
  topbarActions: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: COLORS.orangeBrand, borderWidth: 1.5,
  },

  // ── Hero CTA card ──
  heroCard: {
    borderRadius: 20, padding: 20,
    overflow: 'hidden', borderWidth: 1,
  },
  heroTag: {
    fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
    color: 'rgba(255,255,255,0.38)',
  },
  heroTitle: {
    fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 34, letterSpacing: 0.5,
    color: darkTokens.heroText, marginBottom: 4,
  },
  heroSub: {
    fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19,
    marginTop: 10, marginBottom: 16,
  },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 13,
    borderRadius: 13, alignSelf: 'flex-start',
  },
  heroBtnText: { fontFamily: FONTS.sansMedium, fontSize: 14 },

  // ── Services grid ──
  servicesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10,
  },
  serviceCard: {
    borderRadius: 18, borderWidth: 1,
    padding: 14,
  },
  serviceIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  serviceCardName: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  serviceCardFrom: {
    fontFamily: FONTS.mono, fontSize: 10.5,
    letterSpacing: 0.6, marginTop: 3,
  },

  // ── Section headers ──
  sectionHead: {
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitle: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionActionText: { fontFamily: FONTS.mono, fontSize: 11 },

  // ── Activity list ──
  activityList: { paddingHorizontal: 16 },

  emptyActivity: { padding: 44, alignItems: 'center', gap: 10 },
  emptyActivityIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  emptySub: { fontFamily: FONTS.sans, fontSize: 13, textAlign: 'center' },

  // ── See all button ──
  seeAllBtn: {
    marginHorizontal: 16, marginTop: 4,
    paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  seeAllText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.2 },

  // ── Bottom sheet ──
  sheetBg: { borderRadius: 28 },
  sheetIndicator: { width: 36 },
  sheet: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  sheetTitle: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 24, marginBottom: 10, letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, marginBottom: 20,
    borderWidth: 1,
  },
  statusBadgeText: { fontFamily: FONTS.mono, fontSize: 12 },

  sheetRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  sheetRowIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetVal: { fontFamily: FONTS.sans, flex: 1, fontSize: 14, lineHeight: 21, paddingTop: 5 },

  actionBtn: {
    flexDirection: 'row', height: 54,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 18,
  },
  actionBtnText: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 17, letterSpacing: 0.8 },

  resendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 12, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
  },
  resendText: { fontFamily: FONTS.mono, fontSize: 13 },

  doneCard: {
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
    borderWidth: 1,
  },
  doneText: { fontFamily: FONTS.sansMedium, fontSize: 14 },

  expiredCard: {
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 18,
    borderWidth: 1,
  },
  expiredTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, marginBottom: 4 },
  expiredSub: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
});
