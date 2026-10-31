// lib/types/common.ts
// Briques communes du contrat serveur. Le backend n'est pas dans ce dépôt :
// ces formes sont déduites de la façon dont l'app lit les réponses.

/** Date ISO 8601 telle que sérialisée par le serveur (JSON). */
export type ISODateString = string;

/**
 * Réponse dont la charge utile est à la racine, mais que certaines routes
 * (plus anciennes) enveloppent encore dans `data`. Les appelants lisent
 * `res.data ?? res` : les deux formes passent.
 */
export type Enveloped<T> = T & { data?: T; success?: boolean };

/** Réponse d'action sans charge utile utile (accusé de réception). */
export type OkResponse = { ok?: boolean; success?: boolean; message?: string };

/** Charge utile JSON non typée : réponse qu'aucun appelant ne lit encore. */
export type UnknownPayload = Record<string, unknown>;
