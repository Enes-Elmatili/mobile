# Live Activity « suivi du prestataire » — plan d'implantation

**Objectif :** l'îlot noir du suivi sort de l'app. Dès qu'un prestataire
accepte, le client le voit arriver dans la Dynamic Island et sur l'écran
verrouillé, sans rouvrir FIXED, jusqu'à la fin de la mission.

**Tech :** `expo-widgets` ~58.0.23 (Live Activities iOS + notifications
custom Android), `@expo/ui` (dépendance d'expo-widgets), APNs côté backend.
Pas d'Expo Go : dev build uniquement.

---

## Ce que la Live Activity raconte

Une seule source de vérité : `stageOf()` (lib/mission/stage.ts). Une
fonction pure `activityPropsOf(stage, facts)` traduit le stade en props.

| Stade | Écran verrouillé (banner) | Île compacte (gauche · droite) | Minimal |
|---|---|---|---|
| `accepted` / `en_route` | « Karim arrive » · barre de progression · « 8 min » | icône métier · `8 min` | `8'` |
| `at_door` | « Karim est à votre porte » · **code d'arrivée en grand** | icône · code `4821` | point plein |
| `ongoing` | « Intervention en cours » · chrono depuis `startedAt` | icône · chrono | chrono |
| `quote_pending` / `quote_sent` | « Devis en préparation » / « Devis reçu — 120 € » | icône · `Devis` | `€` |
| réassignation | « Nouveau prestataire en recherche » | icône · radar | — |
| `done` / `pending_payment` | « Mission terminée · 85 € » puis fin | — | — |
| annulée | fin immédiate | — | — |

**Charte :** fond noir, texte blanc, typographie forte. L'île est déjà noire,
c'est l'extension naturelle de l'îlot de l'app. Icônes en contour au repos,
pleines pour l'état actif. Pas d'adresse complète sur l'écran verrouillé :
prénom, ETA, code uniquement.

**`staleDate` :** en route = maintenant + 3 min. Si plus aucune position
n'arrive, `isStale` passe à `true` sans que l'app tourne. La Live Activity
grise l'ETA et affiche « Position à jour il y a… » au lieu de mentir.

---

## Phase 0 — Socle (½ jour)

1. `npx expo install expo-widgets @expo/ui`.
2. `app.json` : plugin `expo-widgets` avec `groupIdentifier`
   (`group.app.thefixed.client`), `enablePushNotifications: true`,
   `frequentUpdates: true` (les mises à jour GPS en ont besoin).
3. EAS : la cible extension (widgets) demande un nouveau provisioning profile
   et l'App Group sur l'identifiant Apple. `eas credentials` le gère au
   premier build.
4. Build dev iOS, vérifier qu'une Live Activity « hello » démarre sur un
   iPhone physique (iOS 17+).

## Phase 1 — Live Activity pilotée par l'app (2–3 jours)

Fonctionne tant que l'app est ouverte ou vient de passer en arrière-plan.

1. `lib/live/missionActivity.ts`
   - `activityPropsOf(stage, facts)` : fonction pure, testée en jest comme
     `stageOf` (une table de cas par stade).
   - `MissionTrackingActivity = createLiveActivity('MissionTracking', layout)` :
     le layout (`banner`, `compactLeading/Trailing`, `minimal`,
     `expanded*`) en composants Expo UI, directive `'widget'`.
2. `lib/live/useMissionLiveActivity.ts` : hook monté dans
   `app/request/[id]/missionview.tsx`, là où vivent déjà stade, ETA, position
   et code PIN.
   - démarre à l'acceptation (`start(props, 'fixed://request/<id>/missionview', staleDate)`),
   - `update()` à chaque changement de props (ETA arrondie à la minute pour
     ne pas gaspiller le budget de mises à jour d'Apple),
   - `end()` à la fin : `after(+15 min)` pour « terminée »,
     `'immediate'` pour une annulation.
3. Reprise : au lancement, `getInstances()` récupère une activité en cours
   pour ne jamais en ouvrir deux pour la même mission.
4. Réglage utilisateur : un interrupteur dans les préférences de feedback
   existantes (`useFeedbackPrefs`), activé par défaut.

**Limite assumée :** en arrière-plan, le socket se coupe. L'activité garde
le dernier état et passe en « périmée » au bout de 3 min. La phase 2 règle
ça.

## Phase 2 — Mises à jour par push APNs (3–4 jours, backend)

Le vrai suivi temps réel, même app fermée.

1. App : `activity.addPushTokenListener()` → `POST /requests/:id/live-activity`
   avec le token. Le token change : on renvoie chaque nouvelle valeur.
2. Backend : à chaque `provider:location_update` (limité à 1 push / 30 s par
   mission) et à chaque changement de statut, envoyer un push APNs :
   - en-têtes `apns-push-type: liveactivity`,
     `apns-topic: app.thefixed.client.push-type.liveactivity`,
   - corps : `aps.event` = `update` ou `end`, `aps.timestamp`,
     `aps.stale-date`, et `aps.content-state` =
     `{ "name": "MissionTracking", "props": "<JSON des props>" }`
     (format attendu par expo-widgets : `props` est une **chaîne JSON**).
   - Envoi direct à APNs avec une clé `.p8` (le service push d'Expo ne gère
     pas ce type de push).
3. Le backend calcule l'ETA lui-même (même logique que
   `lib/mission/route.ts`) pour que l'app n'ait pas besoin de tourner.

## Phase 3 — Démarrage à distance « push-to-start » (1–2 jours)

Le client commande, ferme l'app, et la Live Activity apparaît quand même
au moment de l'acceptation.

1. App : `addPushToStartTokenListener()` au login → token envoyé au backend
   (iOS 17.2+).
2. Backend : à l'acceptation, push `event: start` avec les attributs et le
   premier état. Ensuite, la phase 2 prend le relais.

## Phase 4 — Android (2 jours)

`CustomNotification` d'expo-widgets : une notification persistante avec la
même mise en page monochrome et les mêmes props (`activityPropsOf` est
partagé). Pilotée par l'app d'abord, puis par messages FCM.

## Phase 5 (option) — Côté prestataire : le Wallet dans l'île

Pendant une mission : chrono et montant de la mission. Hors mission, en
ligne : « En ligne · 142 € aujourd'hui ». Ça rend les gains omniprésents,
exactement l'objectif Wallet en cours.

---

## Tests

- **Jest :** `activityPropsOf` (une ligne par stade, cas périmé, cas
  réassignation), et le hook avec `expo-widgets` mocké (start une fois,
  update sur changement, end à la fin, pas de doublon après relance).
- **Sur iPhone physique :** accepter, verrouiller l'écran, vérifier l'ETA ;
  passer en mode avion 3 min (état périmé) ; code PIN à la porte ; fin et
  disparition ; annulation.
- **Backend :** pushes APNs en sandbox avant la prod.

## Points de vigilance

- **Budget Apple :** trop de mises à jour et iOS les ralentit
  (`isActivityUpdateReduced`). D'où l'arrondi à la minute et la limite de
  30 s.
- **Durée :** 8 h maximum pour une Live Activity active. On la termine
  proprement à chaque fin de mission.
- **Vie privée :** pas d'adresse ni de nom de famille sur l'écran verrouillé.

## Ordre recommandé

Phase 0 + 1 d'abord : visible en démo en moins d'une semaine, sans toucher
au backend. Puis la phase 2, qui transforme l'effet démo en vrai produit.
