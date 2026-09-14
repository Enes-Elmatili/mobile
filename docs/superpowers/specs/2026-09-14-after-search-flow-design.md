# Après la recherche : la carte continue le récit, puis s'efface

Date : 14/09/2026 · Décision : variantes A / A / A (bascule sur place, carte en bandeau pendant le travail, bilan et note sur un écran).
Planches : artefact « La carte continue le récit ». Suite de la spec `2026-09-13-searching-map-story-design.md`.

## Thèse

Chaque mouvement de l'écran correspond à un fait envoyé par le serveur, de la recherche jusqu'à la note. Un seul écran de suivi (`app/request/[id]/missionview.tsx`) avec des **stades** ; jamais de remontage entre deux stades ; la carte suit tant qu'elle a quelque chose à dire, puis devient un bandeau.

## Stades (client)

Calculés par une fonction pure `stageOf(request, local)` (`lib/mission/stage.ts`) à partir du statut serveur et de deux faits locaux (arrivée reçue, code vérifié) :

| Stade | Condition | Carte | Feuille |
|---|---|---|---|
| `searching` | `PUBLISHED` | verrouillée (LiveMapSearching, inchangé) | titre recherche, ligne mission, annuler |
| `accepted` | `ACCEPTED` immédiat, < 2 s après la bascule | même carte : la pastille du prestataire prend, les autres s'éteignent, trait → itinéraire | « {Prénom} a accepté » · « Il se met en route. Arrivée vers hh:mm. » · ligne prestataire · ligne mission · réassurance |
| `en_route` | `ACCEPTED` immédiat (ou `QUOTE_ACCEPTED`), pas d'arrivée | suit le prestataire, itinéraire, recadrage à chaque position | kicker `EN ROUTE · LIVE GPS` · ETA DigitReel « 4 MIN · 1,1 KM » · ligne prestataire · carte PIN compacte · ligne « Votre demande » repliée |
| `at_door` | arrivée reçue (`mission:before_photo`, `beforePhotoAt`, ou position à < 60 m) et code non vérifié | zoom sur l'adresse, halo de la maison respire une fois | kicker `ARRIVÉ · hh:mm` · « {Prénom} est là » · PIN héros 64 pt · ligne prestataire · réassurance |
| `ongoing` | `ONGOING` (code vérifié) | bandeau de 132 pt (carte figée) + bande « {Prénom} · chez vous · depuis hh:mm » avec appel | kicker `EN COURS · n MIN` · « {Prénom} travaille » · « Fin prévue vers hh:mm » · chronologie (arrivé, démarrée, photo avant, fin prévue) · montant avec sa promesse · ligne demande · lien support |
| `quote_pending` | `QUOTE_PENDING` | comme `en_route` (le prestataire vient pour le diagnostic) | kicker `DEVIS · FRAIS PAYÉS` · « {Prénom} prépare votre devis » · 4 étapes · ligne prestataire · ligne demande · annuler |
| `quote_sent` | `QUOTE_SENT` | — | `router.replace(quote-review)` (écran conservé) |
| `scheduled` | `ACCEPTED` avec créneau > 30 min | — | `router.replace(scheduled)` (écran conservé, enrichi) |
| `done` | `DONE` | effacée (hauteur 0) | la feuille monte jusqu'en haut : bilan + note (`DoneContent`) |
| terminal | `CANCELLED`, `REFUNDED`, `QUOTE_REFUSED`, `QUOTE_EXPIRED` | — | toast puis accueil |

`accepted` est un stade éphémère : `en_route` avec un titre différent pendant 2,4 s (ou 0 s sous réduction des animations), puis le titre laisse place à l'ETA.

## Une page, une carte, une feuille (révision du 14/09, après retour d'Enès)

Aucun changement d'écran du premier au dernier stade. `missionview` monte **une seule `MapView`** dès le chargement et **une seule feuille** ancrée en bas. La recherche est un calque (`components/searching/SearchingOverlay`, pastilles et traits calculés par `pointForCoordinate`) posé sur cette carte, et un contenu de feuille (`SearchingSheet`) ; les faits (proches, vagues, refus) viennent du hook `lib/mission/useSearching`. Le bilan Terminé est le contenu de la même feuille (`components/tracking/DoneContent`) : la carte se réduit à zéro et la feuille monte jusqu'en haut. La route `rating` ne sert plus qu'aux liens profonds.

## Transitions

- Recherche → accepté : sur la même carte, la pastille acceptée « prend » (MOTION.take), les autres s'éteignent (opacité 0,28), les traits se retirent. Après 2,4 s le calque s'efface en fondu (320 ms) pendant que le marqueur natif du prestataire apparaît, l'itinéraire se révèle et la carte se déverrouille ; la feuille change de contenu (StageHeader), son bord haut suit le nouveau contenu sur `MOTION.pane`. Aucun spinner, aucun `router.replace`.
- `missionview` écoute lui-même `request:accepted` / `provider:accepted` (refetch puis bascule). L'accueil ne navigue vers le suivi **que s'il est l'écran focalisé**.
- En route → à la porte : `mapRef.animateToRegion` sur l'adresse (ressort recentrage), la carte PIN compacte grandit vers le héros (même composant, `useTakeScale`).
- À la porte → en cours : la carte se réduit en bandeau (hauteur animée 132 pt sur `MOTION.pane`), la feuille monte. Haptique `success` sur la même frame (déjà : `mission:pin_verified`).
- En cours → terminé : `request:completed` → la carte (bandeau) se réduit à zéro et la feuille monte jusqu'en haut avec le bilan (`DoneContent`), sur `MOTION.pane`. Pas de changement d'écran.
- Réassignation : retour au stade `searching` (inchangé).
- Sous réduction des animations : coupes nettes.

## Données

Tout vient de `GET /requests/:id` (plus de paramètres d'URL pour le montant, le service, l'adresse) :
- `brief.money.gross` (prix fixe) ou `quote.total` (devis accepté, déjà dans la réponse) ;
- `brief.timeline` gagne `arrivedAt` (= `beforePhotoAt`) et `startedAt` (**nouveau champ Prisma `Request.startedAt`**, posé à la vérification du code) ;
- `brief.work` nouveau : `{ beforePhotoUrl, beforePhotoAt, afterPhotoUrl, afterPhotoAt }` ;
- durée prévue : `brief.service.durationMinutes` ; fin prévue = `startedAt + durationMinutes`.
- `mission:after_photo` (déjà émis) met à jour la chronologie en direct.

## Écran Terminé (`app/request/[id]/rating.tsx`, refait)

Route conservée (deep links, `resolveRequestDestination`). Contenu : kicker `TERMINÉ · hh:mm`, « C'est réparé » (`tracking.done_title`), « {Prénom} a terminé en n minutes », photos avant / après (ou photos de la demande si le prestataire n'en a pas pris), trois faits (durée, montant payé TTC, reçu → Documents), puis la note : étoiles (composant existant), puces après la première étoile, commentaire repliable, CTA Envoyer, lien « Plus tard ». Avatar réel. Après envoi : `feedback.event('mission_complete')` puis accueil. « Plus tard » → accueil ; la mission reste à noter depuis l'îlot de l'accueil (état `DONE` sans avis).

## Devis

- `quote-pending.tsx` devient une redirection vers `missionview` (route gardée pour les liens) ; `resolveRequestDestination` envoie `QUOTE_PENDING` vers `missionview`.
- `quote-review.tsx` : ligne prestataire avec message et appel, photos de la demande, texte FR en dur remplacé par une clé, `router.replace(missionview)` sans paramètres.

## Planifié

`scheduled.tsx` : bloc prestataire (avatar, note, message, appel) et `ClientRequestSummary` (photos). Rien d'autre ne change.

## Composants partagés (`components/tracking/`)

- `StageHeader` (kicker mono + titre Bebas 30 + sous-titre), fondu entre stades.
- `EtaHero` (DigitReel + « MIN · x KM », état « Départ confirmé, position bientôt » sans GPS).
- `ProviderRow` (avatar réel via `Avatar`, nom, note · missions, boutons message avec badge non-lus et appel intégré `useCall().initiateCall` avec repli `tel:`), utilisé par le suivi, le devis reçu et le planifié.
- `PinCard` (`compact` | `hero`).
- `RequestRow` (ligne repliée → `ClientRequestSummary` déplié).
- `QuoteSteps` (4 étapes).
- `WorkTimeline` (lignes heure · fait · vignette).
- `MoneyLine` (montant + promesse).
- `MapBand` (bande prestataire sur la carte réduite).

Tout passe par `useAppTheme` (aucune couleur en dur), Feather, `feedback.*`, presets `MOTION.*`, `useReduceMotion`.

## Ce qui part de `missionview.tsx`

`GhostMarker(s)`, `CenterLogo`, `DynamicMessage`/`getSteps`, `elapsed`, dérive de carte, `handleSendMessage` + `TextInput`, `ConfirmModal` maison (→ `feedback.confirm`), les 3 métriques, styles orphelins, `MAP_STYLE_*` dupliqués (→ `lib/mapStyles.ts` partagé avec `ongoing.tsx`), imports morts.

## i18n

Nouveau namespace `tracking.*` (fr/nl/en) : `accepted_title`, `accepted_sub`, `en_route`, `live_gps`, `min`, `km`, `no_gps`, `pin_compact`, `arrived`, `at_door_title`, `at_door_sub`, `at_door_reassurance`, `ongoing`, `ongoing_title`, `ongoing_sub`, `since`, `at_home`, `tl_arrived`, `tl_started`, `tl_before_photo`, `tl_after_photo`, `tl_by`, `tl_end_planned`, `tl_usual_duration`, `fixed_promise`, `quote_promise`, `support_link`, `your_request`, `quote_kicker`, `quote_title`, `quote_sub`, `quote_step_sent`, `quote_step_paid`, `quote_step_diag`, `quote_step_72h`, `done_kicker`, `done_title`, `done_sub`, `before`, `after`, `fact_minutes`, `fact_paid`, `fact_receipt`, `rate_question`, `later`, `quote_gone`. Les clés `mission_view.search_step*`, `mission_view.estimated_arrival` et consorts (mortes) sont supprimées.

## Tests

- `lib/mission/stage.ts` : table de vérité (statuts × faits locaux × créneau).
- `brief.ts` : `timeline.startedAt/arrivedAt`, `work`.
- `requestDestination` : `QUOTE_PENDING` → missionview.
- backend : `missionBrief` (timeline, work), route de vérification du code pose `startedAt`.
- Sur appareil : accepter une mission avec deux téléphones, vérifier chaque stade et les logs.
