# Photos guidées par prestation et fiche mission unifiée — design

Date : 13/09/2026. Choix validés sur les planches (artifact « Planches de la mission ») : **1A, 2A, 3A, 4A**, avec les réponses d'Enès : le client prend les photos, guidé par la prestation ; les consignes vivent dans le code de l'app ; chaque prise porte son propre drapeau « requise » ou « conseillée ».

Deux chantiers, livrés dans cet ordre (la fiche a besoin des photos) :

1. **Photos guidées** — le client photographie ce que la prestation demande ; le serveur les stocke sur la demande.
2. **Fiche mission unifiée** — un seul objet « fiche » construit par le serveur et envoyé partout ; quatre habillages : mission entrante, lignes de liste, fiche détaillée, suivi côté client.

---

## Partie 1 — Photos guidées par prestation

### 1.1 Thèse
Le prestataire accepte aujourd'hui à l'aveugle : titre, prix, adresse. Une fuite d'eau, c'est trois prises qui décident de tout — la fuite, sous l'évier, le compteur. La prestation choisie dicte ses prises ; le client cadre ce qu'on lui demande, dans un appareil photo plein écran qui affiche la consigne. Certaines prises sont requises (la serrure pour une ouverture de porte), les autres conseillées.

### 1.2 Données
- `RequestPhoto` (existante, jamais branchée) gagne `shotKey String?` : la clé de la consigne (`under_sink`, `lock_close`…) ou `null` pour une photo libre. Migration additive.
- Une demande porte au plus **6** photos. Format JPEG, redimensionné côté app à 1 600 px de large maximum, qualité 0,75 (≈ 300–500 Ko).
- Les consignes : `mobile/constants/photoGuides.ts`, table `PHOTO_GUIDES` indexée par **slug de sous-catégorie** (40 sous-catégories plomberie et serrurerie du catalogue live), chaque entrée = liste de `{ key, required }`. Une sous-catégorie absente de la table reçoit le guide générique (« le problème », « vue d'ensemble », rien de requis). Les libellés et aides sont des clés i18n `shots.<key>.label` / `shots.<key>.hint` en fr/nl/en. Les clés de prise sont partagées entre prestations (une vingtaine en tout).

### 1.3 Serveur
- `POST /api/requests/:id/photos` — `authenticate`, multipart `photo` (réutilise `missionUpload` : dossier `missions/`, nom aléatoire 192 bits, 10 Mo, jpeg/png/webp), champs `shotKey?` (≤ 40 car.), `width?`, `height?`. Refus : demande introuvable (404), appelant ≠ `clientId` (403), statut `COMPLETED`/`CANCELLED`/`REFUNDED` (400 `INVALID_STATE`), 7e photo (400 `PHOTO_LIMIT`). Réponse `201 { photo: { id, url, shotKey, width, height } }`.
- `GET /api/requests/:id` inclut `photos` (id, url, shotKey, width, height, ordre d'insertion). Servies par `GET /api/uploads/missions/:file` (existant).
- Tests : `tests/requestPhotos.test.js` — propriétaire → 201 et ligne en base ; autre utilisateur → 403 ; limite ; inclusion dans le détail.

### 1.4 App — étape Service (planche 1A)
- Sous la `ServiceRow` cochée, `ShotStrip` : une tuile carrée par consigne (icône, libellé, « REQUIS » en ambre), une tuile « + » pour une photo libre (tant que < 6). Tuile faite : vignette (expo-image), coche verte ; toucher = reprendre.
- Toucher une tuile vide ouvre `app/request/camera.tsx` en modal plein écran (expo-camera `CameraView`) avec une **file de prises** : par défaut toutes les prises manquantes à partir de celle touchée. Barres de progression en haut, consigne en Bebas, aide sur une ligne, cadre à guides verts, déclencheur, « Passer » (prise conseillée seulement), fermer. Après déclenchement : aperçu, « Reprendre » / « Garder », puis la prise suivante. La file et son résultat passent par un mini-store en mémoire (`lib/request/cameraSession.ts`), pas par les params de route.
- Permission caméra refusée : l'écran l'explique et propose la galerie (expo-image-picker, déjà installé).
- Réduction : `expo-image-manipulator` (à ajouter), 1 600 px, JPEG 0,75.
- Le bouton : désactivé tant qu'une prise requise manque, indication « Photo requise : sous l'évier » (mécanique existante des indications). Changer de prestation conserve les photos déjà prises ; seules les prises requises de la nouvelle prestation comptent.
- Envoi : à l'étape 4, juste après la création de la demande (les trois chemins de `api.post('/requests')`), `uploadRequestPhotos(requestId, shots)` envoie les photos une par une (un nouvel essai chacune). Un échec ne bloque pas le paiement : toast d'avertissement, la demande part sans cette photo.
- Reduce-motion et thème : rien de spécifique au-delà de la charte ; icônes Feather.

### 1.5 Pur et testé
`lib/request/photos.ts` : `shotsFor(subcategorySlug)`, `missingRequiredShots(shots, specs)`, `nextQueue(specs, shots, fromKey)`. `__tests__/photos.test.js`.

---

## Partie 2 — Fiche mission unifiée

### 2.1 Thèse
Chaque écran recompose aujourd'hui sa carte avec ce qu'il a : le socket envoie titre, prix, adresse, nom ; la liste des opportunités a l'accès mais pas la mission acceptée ; le détail n'a ni photos ni langue du client. Un seul sérialiseur serveur, `toMissionBrief`, produit la fiche complète ; chaque surface l'habille.

### 2.2 `MissionBrief` (serveur, `services/missionBrief.js`)
```
{
  id, status,
  service:  { id, name, nameI18n, slug, categoryId, categoryName, categorySlug, categoryIcon, pricingMode, durationMinutes },
  description,
  photos:   [{ id, url, shotKey, width, height }],
  schedule: { at: ISO|null, urgent, mode: 'now' | 'slot' },   // now = preferredTimeStart à moins de 30 min de createdAt
  place:    { address, lat, lng, distanceKm: number|null },
  access:   { buildingType, floor, hasElevator, notes },        // champs access* de la demande
  client:   { name, language, avatarUrl, city, missionsCount: number|null },
  money:    { gross: €, net: €|null, calloutFee: €|null, pricingMode },   // net = gross × (1 − taux du presta destinataire)
  timeline: { createdAt, acceptedAt, completedAt },
  provider: { name, avatarUrl, avgRating, languages } | null     // pour le client
}
```
- `BRIEF_INCLUDE` : l'include Prisma unique (category, subcategory, client, photos, provider.user).
- `net` via `commissionRateForProvider` (source unique du taux, subscriptionService) pour le prestataire destinataire ; `null` côté client.
- `client.missionsCount` (demandes COMPLETED du client) calculé pour la mission entrante et le détail ; `null` dans les listes (pas de requête par ligne).
- Attaché sous la clé `brief` **en plus** des champs existants (compatibilité avec l'app en production) : diffusion socket `new_request` et `new_opportunity`, `GET /requests/opportunities`, `GET /requests/incoming`, `GET /providers/missions`, `GET /requests/:id` (net pour le prestataire, bloc `provider` pour le client).
- Tests : `tests/missionBrief.test.js` — forme, `schedule.mode`, `net`, absence de `net` côté client, photos ordonnées ; et un test d'intégration sur `GET /requests/:id` (client et prestataire).

### 2.3 App — composants (`components/mission/`)
Tous consomment `MissionBrief` (`lib/mission/brief.ts`, avec `briefFromLegacy(item)` pour un payload sans `brief`).

- `CountdownRing` — anneau SVG qui se vide (Reanimated `useAnimatedProps` sur le `strokeDashoffset`), chiffre au centre en Bebas ; couleur : texte → muted → rouge (interpolation existante).
- `PhotoThumbs` — jusqu'à trois vignettes 4:3 avec la consigne en légende mono, « +n » ; `PhotoGallery` — rangée défilante de 120×90 avec légendes ; `PhotoViewer` — Modal plein écran, pagination horizontale, fermeture au toucher. Sans photo : ni vignettes ni section.
- `MissionFacts` — grille deux colonnes : créneau (« Maintenant · urgent » / « Lun 15 · 10:00 »), distance (« 6 min · 2,1 km » + quartier), accès (« 3e, ascenseur » + code), client (« Sophie M. · FR » + « 4,9 · 3 missions » si connu), puis la phrase du client en pleine largeur, entre guillemets.
- `EarnRow` — net en Bebas 30, « net · brut X € », pastille du mode de prix (vert fixe / ambre devis).
- `AccessBlock`, `ClientBlock` (avatar initiales, nom + drapeau langue, note, phrase, boutons message / appel).
- `IncomingMissionCard` (planche 2A) — remplace le contenu d'`IncomingJobCard` dans `provider-dashboard.tsx` : en-tête (icône catégorie, prestation en Bebas, « catégorie · mode · durée », `CountdownRing`), `PhotoThumbs`, `MissionFacts`, `EarnRow`, `SlideToConfirm` (existant), « Refuser ». Entrée et sortie : les animations actuelles de la carte (glissé depuis le bas) sont conservées.
- `MissionRow` (planche 3A) — vignette 56 pt (première photo + compteur, sinon icône de catégorie sur `surface`), prestation, ligne « créneau · lieu, distance », puces mono (URGENT ambre, étage/ascenseur, langue), gain à droite en Bebas tabulaire ; colonne heure optionnelle (missions à venir). Glissé droite = accepter, gauche = refuser (RNGH `ReanimatedSwipeable`) sur les opportunités seulement ; toucher = fiche.
- `MissionSheetContent` (planche 4A) — le corps partagé de `MissionDetail` et `OpportunityDetail` : carte (bloc existant), titre + sous-ligne (catégorie · mode · durée · URGENT), `PhotoGallery`, `AccessBlock`, `ClientBlock`, `EarnRow`, chronologie (existante), et un emplacement `actions` fourni par l'appelant (Refuser + glissé ; Itinéraire + Démarrer ; Devis).
- `ClientRequestSummary` (planche 4A, côté client) — `MissionRow` de sa demande (prix TTC à droite), `PhotoGallery` de ses photos, bloc prestataire (nom, langues, note, missions, message / appel). Inséré sous la carte dans `missionview.tsx` et `ongoing.tsx`.

### 2.4 Intégration
- `provider-dashboard.tsx` : `handleNewRequest` lit `data.brief` (sinon `briefFromLegacy(data)`), `IncomingJobCard` rend `IncomingMissionCard`.
- `missions.tsx` : `OpportunityCard` et `MissionCard` → `MissionRow` ; `MissionDetail` / `OpportunityDetail` → `MissionSheetContent` + leurs actions. `ProviderMissionCard.tsx` (plus utilisé) est supprimé.
- Le net côté app vient de `brief.money.net` quand il existe, sinon de `NET_RATE` (comportement actuel).
- Disposition : `MissionRow` et `MissionSheetContent` lisent `useLayoutClass` ; en volet droit (regular), la galerie passe en grille 3 colonnes.

### 2.5 Mouvement
Entrée de carte, glissé pour accepter, poussées : presets existants (`MOTION.pane`, `MOTION.take`, `usePressScale`). Anneau : `withTiming` linéaire sur la durée du compte à rebours, reduce-motion : chiffre seul. Glissé sur ligne : `ReanimatedSwipeable` avec `overshootFriction`, haptique `medium` au seuil.

### 2.6 Erreurs et cas limites
- Photo manquante ou URL cassée : vignette remplacée par l'icône de catégorie ; la fiche ne casse pas.
- Payload socket sans `brief` (ancienne API en cache) : `briefFromLegacy` ; les champs absents ne s'affichent pas.
- Client sans langue : pas de drapeau. Accès vide : bloc absent. Description vide : pas de citation.
- Distance inconnue (liste) : la ligne montre le lieu seul.

### 2.7 Tests
Backend : `requestPhotos.test.js`, `missionBrief.test.js`. Mobile : `photos.test.js` (guides, requis manquants, file), `brief.test.js` (`briefFromLegacy`, `netFor`, `scheduleLabel`), garde-fous existants (lint, tsc, jest).

### 2.8 Ordre de livraison
Plan `2026-09-13-guided-photos-and-mission-brief.md` : (1) serveur photos ; (2) app photos ; (3) serveur fiche ; (4) app fiche prestataire ; (5) app fiche client, nettoyage, release.
