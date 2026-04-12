// hooks/useProviderDiscovery.ts — Provider discovery with geolocation + filters
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import { devLog, devWarn } from '../lib/logger';

export interface DiscoveredProvider {
  id: string;
  name: string;
  city: string | null;
  avgRating: number;
  jobsCompleted: number;
  distanceKm: number;
  responseTimeMinutes: number;
  status: string;
  categories: { id: number; name: string; slug: string }[];
}

export interface DiscoveryFilters {
  categoryId: number | null;
  radiusKm: number;
  minRating: number;
}

const DEFAULT_FILTERS: DiscoveryFilters = {
  categoryId: null,
  radiusKm: 5,
  minRating: 0,
};

export function useProviderDiscovery() {
  const [providers, setProviders] = useState<DiscoveredProvider[]>([]);
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Obtenir la localisation de l'utilisateur
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      if (status !== 'granted') {
        setError('permission_denied');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!mounted) return;
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    })();
    return () => { mounted = false; };
  }, []);

  const fetchProviders = useCallback(
    async (overrideFilters?: Partial<DiscoveryFilters>) => {
      if (!userLocation) return;

      const activeFilters = { ...filters, ...overrideFilters };
      setIsLoading(true);
      setError(null);

      try {
        const data: any = await api.providers.available({
          lat: userLocation.lat,
          lng: userLocation.lng,
          radius: activeFilters.radiusKm,
          minRating: activeFilters.minRating,
          ...(activeFilters.categoryId !== null && { categoryId: activeFilters.categoryId }),
        });

        setProviders(data.providers ?? []);
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return;
        setError('fetch_error');
        devWarn('[Discovery] fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [userLocation, filters],
  );

  // Refetch quand la localisation ou les filtres changent
  useEffect(() => {
    if (userLocation) fetchProviders();
  }, [userLocation, filters]);

  const updateFilters = useCallback((newFilters: Partial<DiscoveryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(() => fetchProviders(), [fetchProviders]);

  return {
    providers,
    filters,
    updateFilters,
    isLoading,
    error,
    userLocation,
    refresh,
    hasProviders: providers.length > 0,
  };
}
