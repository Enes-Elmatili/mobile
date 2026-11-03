// components/dashboard/MissionIsland.tsx — l'îlot noir de l'accueil client
// quand une demande vit : prestataire en route / mission en cours (ETA
// dominant), recherche en cours (compte à rebours), ou devis.
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { translateRequestServiceRaw } from '@/lib/categoryLabel';
import { feedback } from '@/lib/feedback/feedback';
import { api } from '@/lib/api';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import { PulseDot } from '@/components/ui/PulseDot';
import { cleanName } from '@/lib/displayName';
import FixedStatusChip from '@/components/ui/StatusBadge';
import FixedAvatar from '@/components/ui/Avatar';
import { PressScale } from '@/components/ui/PressScale';
import { secondsLeft, formatMinSec, haversineEtaMinutes, firstNumber, arrivalLabel } from '@/lib/dashboard/time';
import type { DashboardRequest, Envelope, RequestDetails } from '@/lib/dashboard/types';

const hapticLight = () => feedback.haptic('light');

/** Réponse de l'API Directions de Google, réduite à ce qu'on lit. */
type DirectionsResponse = { status?: string; routes?: { legs: { duration: { text: string } }[] }[] };

const islandTitle = (m: DashboardRequest) =>
  (translateRequestServiceRaw(m) || m.title || m.serviceType || '').toUpperCase();

// Le compte à rebours de la recherche : seul ce texte se redessine chaque
// seconde, pas toute la carte de mission.
function SearchCountdown({ expiresAt, fallback, color }: { expiresAt: string | null; fallback: number; color: string }) {
  const left = useCallback(() => secondsLeft(expiresAt), [expiresAt]);
  const [seconds, setSeconds] = useState(() => left() ?? fallback);
  useEffect(() => {
    const iv = setInterval(() => setSeconds((p) => left() ?? Math.max(0, p - 1)), 1000);
    return () => clearInterval(iv);
  }, [left]);
  return (
    <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color, letterSpacing: 0.5, fontVariant: ['tabular-nums'] }}>
      {formatMinSec(seconds)}
    </Text>
  );
}

export function MissionIsland({
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
  activeMission: DashboardRequest | null;
  searchingMission: DashboardRequest | null;
  quoteMission?: DashboardRequest | null;
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
        const details = await api.get<Envelope<RequestDetails>>(`/requests/${activeMission.id}`);
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
          const data: DirectionsResponse = await res.json();
          if (!cancelled && data.status === 'OK' && data.routes && data.routes.length > 0) {
            const match = firstNumber(data.routes[0].legs[0].duration.text);
            const min = match ? parseInt(match) : null;
            setEtaLabel(arrivalLabel(min, t));
            return;
          }
        }
        const min = haversineEtaMinutes({ lat: provider.lat, lng: provider.lng }, { lat: req.lat, lng: req.lng });
        if (!cancelled) setEtaLabel(arrivalLabel(min, t));
      } catch {
        if (!cancelled) { setHasLiveGps(false); setEtaLabel(t('dashboard.provider_on_way')); }
      }
    };
    fetchETA();
    const iv = setInterval(fetchETA, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMission?.id, activeMission?.status]);


  // ── ACCEPTED / ONGOING — HERO mission island (ETA dominant)
  if (activeMission) {
    const isOngoing = activeMission.status.toUpperCase() === 'ONGOING';
    // Extract ETA minutes from etaLabel (e.g. "Arrivée dans 21 min" → "21")
    const etaMin = firstNumber(etaLabel);

    return (
      <PressScale accessibilityRole="button"
        onPress={onActiveMissionPress}
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
            {islandTitle(activeMission)}
          </Text>

          {/* Address */}
          <IslandAddress address={activeMission.address} theme={theme} />

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
              <PressScale
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: COLORS.greenBrand,
                  alignItems: 'center', justifyContent: 'center',
                }}
                onPress={(e) => { e.stopPropagation?.(); hapticLight(); onCallProvider?.(); }}
                accessibilityRole="button"
                accessibilityLabel="Appeler le prestataire"
              >
                <Feather name="phone" size={18} color="#fff" />
              </PressScale>
              <PressScale
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                  alignItems: 'center', justifyContent: 'center',
                }}
                onPress={(e) => { e.stopPropagation?.(); hapticLight(); onMessageProvider?.(); }}
                accessibilityRole="button"
                accessibilityLabel="Envoyer un message au prestataire"
              >
                <Feather name="message-square" size={18} color={theme.heroText} />
              </PressScale>
            </View>
          )}
        </View>
      </PressScale>
    );
  }

  // ── PUBLISHED — searching (même gabarit que active)
  if (searchingMission) {
    return (
      <PressScale accessibilityRole="button" onPress={onSearchingPress}>
        <View style={{ padding: 20 }}>
          {/* Status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <FixedStatusChip status="SEARCHING" label={t('dashboard.search_in_progress').toUpperCase()} />
            <SearchCountdown key={searchingMission.id} expiresAt={searchingMission.expiresAt ?? null} fallback={SEARCH_TIMEOUT} color={theme.heroSubFaint as string} />
          </View>

          {/* Service name — hero */}
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, color: theme.heroText, letterSpacing: 0.4, marginBottom: 4 }} numberOfLines={1}>
            {islandTitle(searchingMission)}
          </Text>

          {/* Address */}
          <IslandAddress address={searchingMission.address} theme={theme} />

          {/* Searching indicator */}
          <IslandFooter dotColor={COLORS.amber} label={t('dashboard.searching_best_provider')} theme={theme} />
        </View>
      </PressScale>
    );
  }

  // ── QUOTE_PENDING / QUOTE_SENT — devis (même gabarit)
  if (quoteMission && onQuotePress) {
    const isQuoteSent = quoteMission.status?.toUpperCase() === 'QUOTE_SENT';
    return (
      <PressScale accessibilityRole="button" onPress={onQuotePress}>
        <View style={{ padding: 20 }}>
          {/* Status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <FixedStatusChip status={isQuoteSent ? 'QUOTE_SENT' : 'QUOTE_PENDING'} label={isQuoteSent ? t('dashboard.status_quote_sent').toUpperCase() : t('dashboard.status_quote_pending').toUpperCase()} />
            <Feather name="file-text" size={14} color={theme.heroSubFaint} />
          </View>

          {/* Service name — hero */}
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, color: theme.heroText, letterSpacing: 0.4, marginBottom: 4 }} numberOfLines={1}>
            {islandTitle(quoteMission)}
          </Text>

          {/* Address */}
          <IslandAddress address={quoteMission.address} theme={theme} />

          {/* Action hint */}
          <IslandFooter
            dotColor={isQuoteSent ? COLORS.green : COLORS.amber}
            label={isQuoteSent ? t('dashboard.quote_action_review') : t('dashboard.quote_action_waiting')}
            theme={theme}
          />
        </View>
      </PressScale>
    );
  }

  // ── Empty — no active mission (parent shows "Besoin d'un pro?" instead)
  return null;
}

// L'adresse sous le nom du service (les trois états de l'îlot).
function IslandAddress({ address, theme }: { address?: string; theme: AppTheme }) {
  if (!address) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <Feather name="map-pin" size={12} color={theme.heroSub} />
      <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub }} numberOfLines={1}>
        {address}
      </Text>
    </View>
  );
}

// Le pied de l'îlot recherche / devis : LED, consigne, flèche.
function IslandFooter({ dotColor, label, theme }: { dotColor: string; label: string; theme: AppTheme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
      <PulseDot size={8} color={dotColor} />
      <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.heroSub, flex: 1 }}>
        {label}
      </Text>
      <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.heroSubFaint, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="arrow-right" size={14} color={theme.heroSub} />
      </View>
    </View>
  );
}
