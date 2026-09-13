# L'attente d'un prestataire — « la carte devient le récit »

Date : 13/09/2026. Choix d'Enès : avec la carte, sans halo, « sois créatif ».

## Thèse
Pendant la recherche, ce qui bouge à l'écran est un fait, jamais une décoration. Jusqu'ici l'écran empilait une pastille, un cercle qui respire, des anneaux, un minuteur et un fil d'activité **simulé** (« un prestataire notifié » à 8 s, « deux » à 20 s…). Le serveur, lui, prévient cinq prestataires d'un coup puis cinq de plus toutes les deux minutes, et ne disait rien au client.

## Le serveur parle (`services/matchingEvents.js`)
Sur `request:matching` (room `user:<clientId>`) :
- `wave` — à chaque vague (première, escalades, prestataire préféré) : `round`, `providers[{ id, name, avatarUrl, lat, lng, distanceKm, etaMin }]`, `remaining`, `nextWaveInMs`.
- `declined` — un prestataire prévenu a refusé : `providerId`.
L'acceptation passe toujours par `request:statusUpdated`.

## L'écran (`components/searching/LiveMapSearching.tsx`)
- Carte verrouillée (ni panoramique ni zoom), rembourrée de la hauteur de la feuille : l'adresse est au centre de la zone visible. Aucun cercle, aucun anneau, aucune épingle native.
- Les prestataires proches (`/providers/nearby`) dorment : pastille grise à leur position, calculée une fois avec `pointForCoordinate`. Une vague les éveille en cascade (110 ms) : la pastille « prend » sur `MOTION.take`, passe à l'accent, affiche `PRÉNOM · 6 MIN`, et un trait fin (View dont la largeur grandit, sûr sur Android) la relie à l'adresse. Un refus l'éteint à 30 % et retire le trait.
- La feuille : ligne mono `VAGUE 1 · 0:42` (+ `EXPIRE DANS 4:12` sous cinq minutes), titre Bebas qui change avec les faits (« On prévient les prestataires autour de vous » → « Trois prestataires prévenus » → « On prévient la vague suivante » / « On cherche plus loin » → « Yassine a accepté » ; planifié : « Votre créneau est réservé »), sous-ligne, note « n prestataires n'étaient pas disponibles », la ligne de la demande (`MissionRow`), la réassurance, Annuler.
- Reduce-motion : pas de « prend », traits et titres apparaissent sans mouvement.
- Sans prestataire proche connecté : la carte reste nue, le titre dit ce qui se passe.

## Retiré
`BreathingRings.tsx`, la pastille du haut avec spinner et minuteur, le cercle de rayon, les épingles-avatars natives, le fil d'activité simulé et ses clés `ext.searching_feed_*` (inutilisées désormais).
