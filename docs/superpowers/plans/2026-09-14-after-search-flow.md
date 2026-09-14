# Après la recherche — plan d'exécution

> Spec : `docs/superpowers/specs/2026-09-14-after-search-flow-design.md`. Variantes A/A/A validées le 14/09/2026.

**Goal :** un écran de suivi à stades (accepté → en route → à la porte → en cours → terminé, plus devis en préparation), alimenté par le serveur, sans remontage ; un écran Terminé qui réunit bilan et note.

**Architecture :** `stageOf()` pur ; `missionview.tsx` = machine à stades qui compose des blocs `components/tracking/*` ; `rating.tsx` devient l'écran Terminé ; `quote-pending` redirige ; backend expose `startedAt` et `work` dans la fiche.

**Stack :** Reanimated 4 + Gesture Handler, react-native-maps, `lib/motion`, `feedback.*`, Prisma.

---

### Tâche 1 — Backend : `startedAt`, `timeline`, `work` (agent)
- Modify : `backend/prisma/schema.prisma` (Request.startedAt DateTime?), migration `..._request_started_at`.
- Modify : `backend/routes/requests.js` — à la vérification du code (passage ONGOING) poser `startedAt: new Date()`.
- Modify : `backend/services/missionBrief.js` — `timeline: { createdAt, acceptedAt, arrivedAt: beforePhotoAt, startedAt, completedAt }`, `work: { beforePhotoUrl, beforePhotoAt, afterPhotoUrl, afterPhotoAt }` ; `BRIEF_INCLUDE` inchangé (champs scalaires).
- Modify : `request:accepted` payload — ajouter `providerName` (prénom affichable) pour la bascule sans refetch.
- Test : `backend/tests/missionBrief.test.js` (timeline/work), test route PIN verify pose `startedAt`.
- Gate : `npm test` vert ; `prisma migrate deploy` sur `fixed_test`.

### Tâche 2 — Mobile : fondations
- Modify : `lib/mission/brief.ts` — `timeline.arrivedAt/startedAt`, `work`, repli legacy depuis `beforePhotoUrl/At`, `afterPhotoUrl/At`.
- Create : `lib/mission/stage.ts` — `stageOf(req, { arrived, pinVerified, now })` + `plannedEnd(brief)` + `tests/stage.test.js`.
- Create : `lib/mapStyles.ts` — `MAP_STYLE_LIGHT/DARK` partagés ; `ongoing.tsx` et `missionview.tsx` les importent.
- Modify : `locales/{fr,nl,en}.json` — namespace `tracking.*` ; suppression des clés mortes `mission_view.search_step*`.

### Tâche 3 — Composants `components/tracking/`
- Create : `StageHeader.tsx`, `EtaHero.tsx`, `ProviderRow.tsx`, `PinCard.tsx`, `RequestRow.tsx`, `QuoteSteps.tsx`, `WorkTimeline.tsx`, `MoneyLine.tsx`, `MapBand.tsx`, `index.ts`.
- Test : `__tests__/trackingBlocks.test.js` (rendu par stade, PIN hero/compact, RequestRow déplie).

### Tâche 4 — `missionview.tsx` réécrit
- Stades via `stageOf` ; carte unique (TRACKING) + `LiveMapSearching` (SEARCHING) avec `acceptedName` réel ; bascule accepté sur place (2,4 s) ; sockets `request:accepted`, `provider:accepted`, `provider:location_update`, `request:started`, `mission:pin_ready`, `mission:before_photo`, `mission:after_photo`, `mission:pin_verified`, `request:completed`, `request:cancelled`, `request:reassigning`, `request:statusUpdated` ; poll 15 s (recherche) / 45 s (suivi) ; géofence 60 m ; `feedback.confirm` pour annuler ; appel via `useCall`.
- Suppression du code mort listé dans la spec.

### Tâche 5 — Écran Terminé (`rating.tsx`)
- Bilan (kicker, titre, photos avant/après, 3 faits) + note (étoiles existantes, puces après première étoile, commentaire) + « Plus tard ». Avatar réel.

### Tâche 6 — Périphérie
- `quote-pending.tsx` → redirection ; `lib/requestDestination.ts` QUOTE_PENDING → missionview ; `quote-review.tsx` : `ProviderRow`, photos, clé `tracking.quote_gone`, replace sans params ; `scheduled.tsx` : `ProviderRow` + `ClientRequestSummary` ; `dashboard.tsx` : navigation sur acceptation seulement si focalisé.

### Tâche 7 — Gates
- `npx tsc --noEmit`, `npx eslint app components lib hooks eslint.config.js` (0 erreur), `npx jest` ; backend `npm test`. Commit, push, `npm run release`.
