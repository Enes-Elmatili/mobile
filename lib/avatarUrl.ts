// Centralisation de la résolution d'URL avatar.
//
// Le backend stocke les avatars sous deux formats au fil du temps :
//   - Legacy : `/uploads/avatars/<filename>` (avant la suppression du static
//     serving pour des raisons de sécurité)
//   - Actuel : `/api/uploads/avatars/<filename>` (servi par routes/uploads.js
//     avec sandbox basename + path traversal protection)
//
// On rewrite les URLs legacy vers le nouveau format pour que les anciens
// records DB chargent quand même. Tout consommateur d'avatar côté mobile DOIT
// passer par `resolveAvatarUrl` au lieu de bricoler son propre concat.

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || '');
const SERVER_BASE = API_BASE.replace(/\/api\/?$/, '');

export function resolveAvatarUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  // URL absolue (Apple/Google avatar par ex.)
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;

  // Legacy `/uploads/avatars/...` → `/api/uploads/avatars/...`
  const normalized = rawUrl.replace(/^\/uploads\/avatars\//, '/api/uploads/avatars/');

  // Préfixe serveur (host racine, sans le segment /api final)
  return `${SERVER_BASE}${normalized}`;
}
