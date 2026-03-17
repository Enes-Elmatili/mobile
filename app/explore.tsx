// app/explore.tsx — Recherche prestataires à proximité
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  name?: string;
  city?: string;
  avgRating?: number;
  jobsCompleted?: number;
  status?: string;
  lat?: number;
  lng?: number;
  categories?: { id: number; name: string }[];
  distance?: number;
}

// ── Radius options (in km / meters) ──────────────────────────────────────────

const RADII = [
  { label: '1 km',  m: 1_000  },
  { label: '5 km',  m: 5_000  },
  { label: '10 km', m: 10_000 },
  { label: '20 km', m: 20_000 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function distanceLabel(m?: number) {
  if (m === undefined) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// ── Provider Card (bottom list) ───────────────────────────────────────────────

function ProviderCard({ provider, onPress }: { provider: Provider; onPress: () => void }) {
  const theme = useAppTheme();
  const isOnline = provider.status === 'ONLINE' || provider.status === 'READY';
  const init = initials(provider.name);
  const cat = provider.categories?.[0]?.name;

  return (
    <TouchableOpacity style={[pc.card, { borderBottomColor: theme.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[pc.avatar, { backgroundColor: theme.accent }]}>
        <Text style={[pc.avatarText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{init}</Text>
        {isOnline && <View style={[pc.dot, { borderColor: theme.cardBg }]} />}
      </View>
      <View style={pc.info}>
        <Text style={[pc.name, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>{provider.name || 'Prestataire'}</Text>
        <Text style={[pc.sub, { color: theme.textMuted, fontFamily: FONTS.sans }]} numberOfLines={1}>
          {cat ?? provider.city ?? ''}
          {provider.avgRating ? `  ★ ${provider.avgRating.toFixed(1)}` : ''}
        </Text>
      </View>
      {provider.distance !== undefined && (
        <Text style={[pc.dist, { color: theme.textSub, fontFamily: FONTS.mono }]}>{distanceLabel(provider.distance)}</Text>
      )}
      <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { fontSize: 14 },
  dot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: COLORS.green, borderWidth: 2,
  },
  info:  { flex: 1, gap: 2 },
  name:  { fontSize: 14 },
  sub:   { fontSize: 12 },
  dist:  { fontSize: 12, marginRight: 4 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const mapRef = useRef<MapView>(null);

  const [location, setLocation]   = useState<{ lat: number; lng: number } | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [radiusIdx, setRadiusIdx] = useState(1); // default 5 km
  const [loading,   setLoading]   = useState(true);
  const [locError,  setLocError]  = useState(false);

  // ── Location ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocError(true); setLoading(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, []);

  // ── Fetch nearby ─────────────────────────────────────────────────────────────
  const fetchProviders = useCallback(async (lat: number, lng: number, radiusM: number) => {
    setLoading(true);
    try {
      const res: any = await api.providers.nearby(lat, lng, radiusM);
      const list = res?.data ?? res;
      setProviders(Array.isArray(list) ? list : []);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!location) return;
    fetchProviders(location.lat, location.lng, RADII[radiusIdx].m);
  }, [location, radiusIdx, fetchProviders]);

  // ── Center map on user ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!location || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: location.lat,
      longitude: location.lng,
      latitudeDelta: (RADII[radiusIdx].m / 111_000) * 2.5,
      longitudeDelta: (RADII[radiusIdx].m / 111_000) * 2.5,
    }, 600);
  }, [location, radiusIdx]);

  const radiusM = RADII[radiusIdx].m;

  if (locError) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Ionicons name="location-outline" size={52} color={theme.textDisabled} />
        <Text style={[s.errTitle, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>Localisation requise</Text>
        <Text style={[s.errSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Autorisez l'accès à votre position pour voir les prestataires proches.</Text>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.accent }]} onPress={() => router.back()}>
          <Text style={[s.backBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const selectedProvider = providers.find(p => p.id === selected);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.headerBack, { backgroundColor: theme.surface }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('explore.title')}</Text>
        <View style={s.headerCount}>
          {!loading && (
            <Text style={[s.headerCountText, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{providers.length} disponibles</Text>
          )}
        </View>
      </View>

      {/* Map */}
      <View style={s.mapWrap}>
        {location ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: location.lat,
              longitude: location.lng,
              latitudeDelta: (radiusM / 111_000) * 2.5,
              longitudeDelta: (radiusM / 111_000) * 2.5,
            }}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {/* Radius circle */}
            <Circle
              center={{ latitude: location.lat, longitude: location.lng }}
              radius={radiusM}
              strokeColor={theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}
              fillColor={theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
              strokeWidth={1}
            />

            {/* Provider pins */}
            {providers.map(p => {
              if (!p.lat || !p.lng) return null;
              const isSelected = p.id === selected;
              return (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  onPress={() => setSelected(p.id)}
                >
                  <View style={[pin.wrap, { backgroundColor: theme.heroBg, borderColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }, isSelected && { backgroundColor: theme.accent, transform: [{ scale: 1.2 }] }]}>
                    <Text style={[pin.text, { color: theme.heroText, fontFamily: FONTS.sansMedium }]}>
                      {initials(p.name)}
                    </Text>
                  </View>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={[s.mapLoading, { backgroundColor: theme.surface }]}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}

        {/* Radius filter overlay */}
        <View style={[s.radiusBar, { backgroundColor: theme.isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.92)' }]}>
          {RADII.map((r, i) => (
            <TouchableOpacity
              key={r.label}
              style={[s.radiusBtn, i === radiusIdx && [s.radiusBtnActive, { backgroundColor: theme.accent }]]}
              onPress={() => setRadiusIdx(i)}
              activeOpacity={0.7}
            >
              <Text style={[s.radiusBtnText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }, i === radiusIdx && { color: theme.accentText }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Selected provider callout */}
      {selectedProvider && (
        <TouchableOpacity
          style={[s.callout, { backgroundColor: theme.heroBg, shadowOpacity: theme.shadowOpacity }]}
          onPress={() => router.push(`/providers/${selectedProvider.id}` as any)}
          activeOpacity={0.85}
        >
          <View style={[s.calloutAvatar, { backgroundColor: theme.surface }]}>
            <Text style={[s.calloutAvatarText, { fontFamily: FONTS.sansMedium, color: theme.heroText }]}>{initials(selectedProvider.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.calloutName, { fontFamily: FONTS.sansMedium, color: theme.heroText }]}>{selectedProvider.name || 'Prestataire'}</Text>
            <Text style={[s.calloutSub, { color: theme.heroSub }]}>
              {selectedProvider.categories?.[0]?.name ?? selectedProvider.city ?? ''}
            </Text>
          </View>
          <View style={[s.calloutCTA, { backgroundColor: theme.surface }]}>
            <Text style={[s.calloutCTAText, { fontFamily: FONTS.sansMedium, color: theme.heroText }]}>Voir le profil</Text>
            <Ionicons name="arrow-forward" size={12} color={theme.heroText} />
          </View>
        </TouchableOpacity>
      )}

      {/* Provider list bottom panel */}
      <View style={[s.list, { backgroundColor: theme.cardBg }]}>
        <View style={[s.listHeader, { borderBottomColor: theme.border }]}>
          <Text style={[s.listTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>
            {loading ? 'Recherche...' : `${providers.length} prestataire${providers.length !== 1 ? 's' : ''}`}
          </Text>
          {loading && <ActivityIndicator size="small" color={theme.accent} />}
        </View>
        <FlatList
          data={providers}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onPress={() => router.push(`/providers/${item.id}` as any)}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <Ionicons name="people-outline" size={36} color={theme.textDisabled} />
                <Text style={[s.emptyText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('explore.no_providers')}</Text>
              </View>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

// ── Pin styles ────────────────────────────────────────────────────────────────

const pin = StyleSheet.create({
  wrap: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  text: { fontSize: 11 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17 },
  headerCount: { minWidth: 38, alignItems: 'flex-end' },
  headerCountText: { fontSize: 12 },

  mapWrap: { height: '40%', position: 'relative' },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  radiusBar: {
    position: 'absolute', top: 12, alignSelf: 'center',
    flexDirection: 'row', gap: 6,
    borderRadius: 20, paddingHorizontal: 6, paddingVertical: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  radiusBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  radiusBtnActive: {},
  radiusBtnText: { fontSize: 12 },

  callout: {
    margin: 12, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 5 },
    }),
  },
  calloutAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  calloutAvatarText: { fontSize: 14 },
  calloutName: { fontSize: 15 },
  calloutSub: { fontSize: 12, marginTop: 2 },
  calloutCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
  },
  calloutCTAText: { fontSize: 12 },

  list: { flex: 1 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  listTitle: { fontSize: 13 },

  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14 },

  errTitle: { fontSize: 28, marginTop: 8 },
  errSub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backBtn:  { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { fontSize: 15 },
});
