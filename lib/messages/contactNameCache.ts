// lib/messages/contactNameCache.ts
// Noms des contacts résolus, partagés entre l'inbox et le fil : un seul appel
// par contact et par session, pas de flash « Contact #XXXXXX ».
const cache = new Map<string, string>();

export const contactNameCacheGet = (id: string) => cache.get(id);
export const contactNameCacheSet = (id: string, name: string) => { cache.set(id, name); };
export const contactNameCacheHas = (id: string) => cache.has(id);
