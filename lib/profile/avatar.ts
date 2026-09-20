// lib/profile/avatar.ts — la photo de profil : URL serveur d'abord, cache
// local en repli hors ligne, envoi vers /me/avatar. Extrait de l'ancien
// app/(tabs)/profile.tsx, comportement inchangé.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { devLog } from '@/lib/logger';
import { resolveAvatarUrl } from '@/lib/avatarUrl';
import { tokenStorage } from '@/lib/storage';
import * as ImagePicker from 'expo-image-picker';
import { showSocketToast } from '@/lib/SocketContext';

const avatarKey = (userId: string) => `@fixed:profile:avatarUri:${userId}`;

export function useAvatar(user: any, refreshMe: () => Promise<unknown>) {
  const { t } = useTranslation();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const avatarUrlProp: string | undefined = (user as any)?.avatarUrl;

  // ── Chargement avatar : URL serveur en priorité (source de vérité) ──
  // Stratégie : on privilégie l'URL serveur car les `file://` locaux cachés peuvent
  // devenir invalides entre sessions (réinstall, simulateur reset). La cache locale
  // n'est utilisée qu'en fallback offline si aucune URL serveur n'est encore connue.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const rawApiUrl = (user as any)?.avatarUrl;
      const apiUri = resolveAvatarUrl(rawApiUrl);
      devLog('[Avatar] Init useEffect — user.avatarUrl:', rawApiUrl, '→ resolved:', apiUri);
      if (apiUri) {
        setAvatarUri(apiUri);
        return;
      }
      // Pas d'URL serveur (jamais uploadé OU /me en échec) → tente la cache
      const cached = await AsyncStorage.getItem(avatarKey(user.id));
      devLog('[Avatar] No API URL, cache value:', cached);
      if (cached) setAvatarUri(cached);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- id + URL suffisent
  }, [user?.id, avatarUrlProp]);


  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePickPhoto = useCallback(async () => {

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSocketToast(t('profile.gallery_denied'), 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    // Store base64 locally — survives Railway restarts and network issues
    const localUri = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    setAvatarUri(localUri);
    if (user?.id) await AsyncStorage.setItem(avatarKey(user.id), localUri);

    // Upload vers /api/me/avatar → met à jour avatarUrl en DB (User + Provider)
    try {
      const token = await tokenStorage.getToken();
      if (!token) throw new Error('Not authenticated');
      const formData = new FormData();
      // @ts-ignore
      formData.append('avatar', { uri: asset.uri, name: 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}) },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      // Cache la server URL résolue (au lieu du file:// local qui devient invalide
      // entre sessions). Ainsi le démarrage suivant trouve une URL stable.
      // Cache-bust : timestamp en query pour forcer Image à recharger même si
      // l'URI est déjà en cache (cas upload sur le même nom de fichier — rare
      // mais possible avec collision ou retry).
      const baseUri = resolveAvatarUrl(data?.avatarUrl);
      const serverUri = baseUri ? `${baseUri}?t=${Date.now()}` : null;
      devLog('[Avatar] Upload OK — server URL:', baseUri, '→ display URI:', serverUri);
      if (serverUri && user?.id) {
        await AsyncStorage.setItem(avatarKey(user.id), serverUri).catch(() => {});
        setAvatarUri(serverUri);
      }
      await refreshMe();
      showSocketToast(t('common.success'), 'success');
    } catch {
      showSocketToast(t('profile.upload_error'), 'error');
    }
  }, [t, user?.id, refreshMe]);


  return { avatarUri, pick: handlePickPhoto };
}
