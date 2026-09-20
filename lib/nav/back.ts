// lib/nav/back.ts — revenir en arrière, ou retomber sur un écran sûr quand
// il n'y a rien derrière (lien profond, notification, app relancée).
import type { Router } from 'expo-router';

export function goBack(router: Router, fallback: string = '/(tabs)/dashboard'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
