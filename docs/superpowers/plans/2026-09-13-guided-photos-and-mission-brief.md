# Photos guidées et fiche mission unifiée — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le client photographie ce que sa prestation demande (consignes en code, prises requises ou conseillées) ; le serveur produit une fiche mission unique (`brief`) que quatre surfaces habillent : mission entrante, lignes de liste, fiche détaillée, suivi client. Spec : `docs/superpowers/specs/2026-09-13-guided-photos-and-mission-brief-design.md`.

**Architecture:** Serveur : `RequestPhoto.shotKey`, `POST /requests/:id/photos` (réutilise `missionUpload`), `services/missionBrief.js` (`BRIEF_INCLUDE`, `toMissionBrief`) attaché sous `brief` aux diffusions socket et aux quatre lectures. App : `constants/photoGuides.ts` + `lib/request/photos.ts` (pur) + `ShotStrip` + écran caméra modal piloté par `lib/request/cameraSession.ts` ; `lib/mission/brief.ts` + composants `components/mission/*` branchés dans provider-dashboard, missions, missionview, ongoing.

**Tech Stack:** backend Express/Prisma/multer (existant), jest ESM ; mobile Expo 54, `expo-camera` et `expo-image-manipulator` (à installer), expo-image, react-native-svg, RNGH `ReanimatedSwipeable`, Reanimated, `lib/motion`, i18n fr/nl/en.

**Conventions :** Feather uniquement ; `useAppTheme` ; jamais `Animated` legacy, `Dimensions.get`, `Alert.alert`, `expo-haptics` direct ; retour à l'appui ; reduce-motion → fondu. À chaque tâche : `npx tsc --noEmit`, `npx eslint app components lib hooks` (0 erreur), `npx jest` ; backend `npm test`. Commits avec `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Tâche 1 : serveur — `shotKey`, `POST /requests/:id/photos`, photos dans le détail

**Files:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_request_photo_shot_key/migration.sql`, `backend/routes/requests.js`, `backend/tests/requestPhotos.test.js`.

- [ ] Schéma : `RequestPhoto` gagne `shotKey String?` ; migration `ALTER TABLE "RequestPhoto" ADD COLUMN "shotKey" TEXT;` (`npx prisma migrate dev --name request_photo_shot_key`).
- [ ] Test (échoue d'abord) : propriétaire → 201 `{ photo: { id, url, shotKey } }` et ligne en base ; autre client → 403 ; 7e photo → 400 `PHOTO_LIMIT` ; `GET /requests/:id` renvoie `photos[]` ordonnées.
- [ ] Route, après `/:id/after-photo` :
```js
const MAX_REQUEST_PHOTOS = 6;
router.post('/:id/photos', authenticate, missionUpload.single('photo'), async (req, res) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ code: 'INVALID_ID' });
  const id = Number(parsed.data.id);
  try {
    const r = await prisma.request.findUnique({ where: { id }, select: { clientId: true, status: true } });
    if (!r) return res.status(404).json({ code: 'NOT_FOUND' });
    if (r.clientId !== req.user.id) return res.status(403).json({ code: 'FORBIDDEN' });
    if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(r.status)) return res.status(400).json({ code: 'INVALID_STATE' });
    if (!req.file) return res.status(400).json({ code: 'NO_FILE' });
    const count = await prisma.requestPhoto.count({ where: { requestId: id } });
    if (count >= MAX_REQUEST_PHOTOS) return res.status(400).json({ code: 'PHOTO_LIMIT', max: MAX_REQUEST_PHOTOS });
    const shotKey = typeof req.body.shotKey === 'string' && req.body.shotKey.trim() ? req.body.shotKey.trim().slice(0, 40) : null;
    const photo = await prisma.requestPhoto.create({ data: {
      requestId: id, url: `/api/uploads/missions/${req.file.filename}`, mime: req.file.mimetype, size: req.file.size,
      width: parseInt(req.body.width, 10) || 0, height: parseInt(req.body.height, 10) || 0, shotKey,
    } });
    return res.status(201).json({ photo: { id: photo.id, url: photo.url, shotKey: photo.shotKey, width: photo.width, height: photo.height } });
  } catch (e) { logger.error('[POST /requests/:id/photos]', e); return res.status(500).json({ code: 'INTERNAL' }); }
});
```
- [ ] `GET /requests/:id` : `photos: { select: { id: true, url: true, shotKey: true, width: true, height: true }, orderBy: { id: 'asc' } }` dans l'include.
- [ ] `npm test` vert, commit, push (Railway).

### Tâche 2 : app — consignes, `ShotStrip`, caméra, envoi

**Files:** `constants/photoGuides.ts`, `lib/request/photos.ts`, `lib/request/cameraSession.ts`, `__tests__/photos.test.js`, `components/request/ShotStrip.tsx`, `app/request/camera.tsx`, `app/request/NewRequestStepper.tsx`, `lib/api.ts`, `app.json`, `locales/*.json`, `package.json`.

- [ ] `npx expo install expo-camera expo-image-manipulator` ; `app.json` plugins : `["expo-camera", { "cameraPermission": "FIXED utilise votre caméra pour photographier le problème à réparer." }]`.
- [ ] `constants/photoGuides.ts` :
```ts
export type ShotSpec = { key: string; required: boolean };
export const GENERIC_SHOTS: ShotSpec[] = [{ key: 'problem', required: false }, { key: 'overview', required: false }];
export const PHOTO_GUIDES: Record<string, ShotSpec[]> = {
  'fuite-eau': [{ key: 'leak', required: true }, { key: 'under_sink', required: false }, { key: 'meter', required: false }],
  'recherche-fuite': [{ key: 'trace', required: true }, { key: 'overview', required: false }, { key: 'meter', required: false }],
  'fuite-colonne-principale': [{ key: 'leak', required: true }, { key: 'column', required: false }],
  'fuite-electromenager': [{ key: 'appliance_hose', required: true }, { key: 'leak', required: false }],
  'debouchage-canalisation': [{ key: 'drain', required: true }, { key: 'under_sink', required: false }],
  'debouchage-wc': [{ key: 'wc_bowl', required: true }],
  'debouchage-hydrocurage': [{ key: 'drain', required: false }, { key: 'overview', required: false }],
  'inspection-camera': [{ key: 'drain', required: false }, { key: 'overview', required: false }],
  'chasse-eau-mecanisme-wc': [{ key: 'wc_tank', required: true }, { key: 'wc_bowl', required: false }],
  'reparation-wc': [{ key: 'wc_bowl', required: true }, { key: 'wc_tank', required: false }],
  'installation-wc': [{ key: 'wc_bowl', required: false }, { key: 'overview', required: false }],
  'remplacement-robinet': [{ key: 'tap', required: true }, { key: 'under_sink', required: false }],
  'installation-sanitaire': [{ key: 'overview', required: true }, { key: 'under_sink', required: false }],
  'installation-douche-baignoire': [{ key: 'bathroom', required: true }],
  'renovation-plomberie': [{ key: 'bathroom', required: false }, { key: 'overview', required: false }],
  'panne-chauffe-eau': [{ key: 'water_heater', required: true }, { key: 'label_plate', required: false }],
  'installation-chauffe-eau': [{ key: 'water_heater', required: false }, { key: 'overview', required: false }],
  'entretien-pompe-chaleur': [{ key: 'heat_pump', required: false }, { key: 'label_plate', required: false }],
  'regonflage-pression': [{ key: 'boiler_gauge', required: true }],
  'detartrage-circuit': [{ key: 'boiler_gauge', required: false }, { key: 'radiator', required: false }],
  'ouverture-porte-claquee': [{ key: 'door_full', required: false }, { key: 'lock_close', required: true }],
  'ouverture-porte-blindee': [{ key: 'door_full', required: true }, { key: 'lock_close', required: true }],
  'cle-cassee-coincee': [{ key: 'lock_close', required: true }, { key: 'key_broken', required: false }],
  'remplacement-cylindre': [{ key: 'lock_close', required: true }, { key: 'door_edge', required: false }],
  'remplacement-serrure': [{ key: 'lock_close', required: true }, { key: 'door_edge', required: true }],
  'reparation-serrure': [{ key: 'lock_close', required: true }, { key: 'door_edge', required: false }],
  'reparation-porte': [{ key: 'door_full', required: true }, { key: 'door_edge', required: false }],
  'installation-verrou': [{ key: 'door_full', required: false }, { key: 'door_edge', required: false }],
  'blindage-porte': [{ key: 'door_full', required: true }, { key: 'door_frame', required: false }],
  'installation-porte': [{ key: 'door_full', required: true }, { key: 'door_frame', required: false }],
  'mise-en-securite-effraction': [{ key: 'door_full', required: true }, { key: 'lock_close', required: false }],
  'securite-porte-accessoires': [{ key: 'door_full', required: false }],
  'double-cle-badge': [{ key: 'key_badge', required: true }],
  'boite-aux-lettres': [{ key: 'mailbox', required: true }],
  'controle-acces': [{ key: 'access_device', required: false }, { key: 'door_full', required: false }],
  'installation-coffre-fort': [{ key: 'overview', required: false }],
  'ouverture-coffre-fort': [{ key: 'safe', required: true }],
  'portail-motorisation': [{ key: 'gate', required: true }, { key: 'gate_motor', required: false }],
  'volets-rideaux-metalliques': [{ key: 'shutter', required: true }],
};
export const SHOT_ICONS: Record<string, string> = { leak: 'droplet', under_sink: 'box', meter: 'activity', trace: 'search', column: 'align-center', appliance_hose: 'link', drain: 'disc', wc_bowl: 'circle', wc_tank: 'square', tap: 'droplet', overview: 'maximize', bathroom: 'layout', water_heater: 'thermometer', label_plate: 'tag', heat_pump: 'wind', boiler_gauge: 'compass', radiator: 'sliders', door_full: 'log-in', lock_close: 'lock', key_broken: 'key', door_edge: 'sidebar', door_frame: 'layout', key_badge: 'key', mailbox: 'inbox', access_device: 'cpu', safe: 'archive', gate: 'grid', gate_motor: 'settings', shutter: 'menu', problem: 'alert-circle' };
```
- [ ] `lib/request/photos.ts` (pur) : `shotsFor(slug)`, `missingRequiredShots(shots, specs)` (clés requises sans photo), `nextQueue(specs, shots, fromKey)` (à partir de `fromKey`, toutes les prises sans photo, `fromKey` en tête même si déjà faite), `MAX_PHOTOS = 6`. Tests dans `__tests__/photos.test.js`.
- [ ] `lib/request/cameraSession.ts` : `start(queue: ShotQueueItem[], onDone: (shots: LocalShot[]) => void)`, `current()`, `resolve(shots)`, `cancel()`. `ShotQueueItem = { key: string | null; required: boolean }`.
- [ ] `components/request/ShotStrip.tsx` (planche 1A) : props `specs`, `shots`, `onTake(key | null)`, `onRetake(key | null, index)`, `count`, `max`. En-tête « Photos pour le prestataire · n sur N », rangée de tuiles (`aspectRatio: 1`, radius 14, bord tireté `theme.border`, « REQUIS » mono ambre), tuile « + » tant que `shots.length < max`, ligne d'encouragement. Tuile faite : `expo-image` + coche `COLORS.greenBrand`. Appui : `usePressScale`.
- [ ] `app/request/camera.tsx` : `CameraView` plein écran (`facing="back"`), `useCameraPermissions` ; refus → texte + bouton « Choisir dans la galerie » (`ImagePicker.launchImageLibraryAsync`). Overlay : barres de file, X, consigne Bebas 28 + aide 13, cadre (bord blanc 70 %, lignes vertes haut/bas), déclencheur 72 pt, « Passer » si `!required`. Prise : `takePictureAsync({ quality: 0.8 })` → `manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.75, format: JPEG })` → aperçu avec « Reprendre » / « Garder » ; à la fin `cameraSession.resolve(shots)` puis `router.back()`. Déclaré modal dans `app/_layout.tsx` : `<Stack.Screen name="request/camera" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />` (ajouter les `Stack.Screen` enfants au `<Stack>` racine).
- [ ] Étape 2 : state `shots: LocalShot[]` ; `specs = shotsFor(selectedSubcategory?.slug)` ; `ShotStrip` sous la `ServiceRow` cochée ; `onTake(key)` → `cameraSession.start(nextQueue(specs, shots, key), (taken) => merge)` puis `router.push('/request/camera')` ; bouton désactivé si `missingRequiredShots(...)` non vide, `hint = t('stepper.hint_photo_required', { label })`.
- [ ] `lib/api.ts` : `requestPhotos.upload(requestId, formData)` sur le modèle de `providerDocs.upload`. `lib/request/photos.ts` : `uploadRequestPhotos(requestId, shots, api)` séquentiel, un nouvel essai par photo, renvoie `{ sent, failed }`.
- [ ] Étape 4 : après chaque `api.post('/requests', payload)` réussi (3 sites) : `const { failed } = await uploadRequestPhotos(rId, shots); if (failed) feedback.toast(t('stepper.photos_upload_failed', { count: failed }), 'warning');`.
- [ ] i18n (fr/nl/en) : `shots.<key>.label` / `.hint` pour les 30 clés ; `stepper.photos_title`, `photos_count`, `photos_nudge`, `hint_photo_required`, `photos_upload_failed` ; `camera.skip`, `camera.retake`, `camera.keep`, `camera.denied`, `camera.pick_gallery`, `camera.close`.
- [ ] tsc, lint, jest ; commit.

### Tâche 3 : serveur — `missionBrief.js` attaché partout

**Files:** `backend/services/missionBrief.js`, `backend/tests/missionBrief.test.js`, `backend/services/matchingService.js`, `backend/routes/requests.js`, `backend/routes/providers.js`.

- [ ] `services/missionBrief.js` : `BRIEF_INCLUDE`, `scheduleMode(r)`, `toMissionBrief(r, { commissionRate = null, distanceKm = null, clientMissionsCount = null, viewer = 'provider' })` selon la spec § 2.2 (montants en euros ; `calloutFee` cents → euros ; `net = commissionRate == null ? null : round2(gross × (1 − rate))`). `briefForProvider(prisma, r, providerId, distanceKm)` calcule le taux via `commissionRateForProvider`.
- [ ] Tests unitaires sur `toMissionBrief` (forme, mode now/slot, net, viewer client → `net: null` + bloc `provider`, photos ordonnées) ; intégration `GET /requests/:id` (client et prestataire).
- [ ] Attacher `brief` : `matchingService` (`new_request` : `briefForProvider` avec la distance ; `new_opportunity` : brief sans net), `GET /requests/opportunities` et `/incoming` (`{ ...item, brief }`, net du prestataire appelant), `GET /providers/missions` (items + brief), `GET /requests/:id`.
- [ ] `npm test`, commit, push.

### Tâche 4 : app — fiche prestataire (entrante, listes, détail)

**Files:** `lib/mission/brief.ts`, `__tests__/brief.test.js`, `components/mission/{CountdownRing,PhotoThumbs,PhotoGallery,PhotoViewer,MissionFacts,EarnRow,AccessBlock,ClientBlock,IncomingMissionCard,MissionRow,MissionSheetContent}.tsx`, `app/(tabs)/provider-dashboard.tsx`, `app/(tabs)/missions.tsx`, supprimer `components/providers/ProviderMissionCard.tsx`, `locales/*.json`.

- [ ] `lib/mission/brief.ts` : type `MissionBrief` (miroir de la spec), `briefFromLegacy(item)` (mappe `IncomingRequest` / item d'opportunité / mission), `netFor(brief, fallbackRate = 0.8)`, `scheduleLabel(brief, t, dayLabel)`, `accessLabel(brief, t)`, `shotLabel(shotKey, t)`. Tests.
- [ ] Composants selon la spec § 2.3 (planche 2A/3A/4A). `CountdownRing` : `Svg` 44 pt, `Circle` `strokeDasharray` = périmètre, `strokeDashoffset` animé par `useAnimatedProps` depuis une shared value `progress` (1 → 0, `withTiming(0, { duration: TIMER_DURATION * 1000, easing: Easing.linear })`), chiffre Bebas 18 au centre.
- [ ] `provider-dashboard.tsx` : `IncomingRequest` gagne `brief: MissionBrief` (`data.brief ?? briefFromLegacy(data)`) ; le corps d'`IncomingJobCard` devient `<IncomingMissionCard brief timeLeft onAccept onDecline />` (l'animation d'entrée existante enveloppe le composant).
- [ ] `missions.tsx` : `OpportunityCard` → `MissionRow` avec `ReanimatedSwipeable` (droite = accepter, gauche = refuser) ; `MissionCard` → `MissionRow time={…}` ; `MissionDetail` et `OpportunityDetail` → `<MissionSheetContent brief map={…} actions={…} inPane />`. Supprimer les styles `opp.*`/`mc.*`/`sd.*` devenus morts.
- [ ] tsc, lint, jest ; commit.

### Tâche 5 : app — côté client, nettoyage, release

**Files:** `components/mission/ClientRequestSummary.tsx`, `app/request/[id]/missionview.tsx`, `app/request/[id]/ongoing.tsx`, plans/docs, `npm run release`.

- [ ] `ClientRequestSummary` : `MissionRow` (prix TTC à droite, sans glissé), « Vos photos » `PhotoGallery`, bloc prestataire (`brief.provider`). Inséré sous la carte dans `missionview.tsx` et `ongoing.tsx` (données : `GET /requests/:id` → `brief`).
- [ ] Vérification complète (tsc, lint 0 erreur, jest ; backend `npm test`), état livré noté dans ce plan, commit, `npm run release`.
- [ ] Passe manuelle (Enès) : demande avec 3 photos → mission entrante chez le prestataire avec vignettes et faits → acceptation par glissé → fiche → côté client, ses photos et son prestataire.
