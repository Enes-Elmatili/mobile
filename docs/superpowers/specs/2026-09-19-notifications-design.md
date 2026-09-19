# Notifications — « Une notification, une vérité »

Date : 2026-09-19. Prototype validé : artifact « Une notification, une vérité ».

## Thèse

Un événement, un catalogue, les bons canaux dans la langue de la personne.
L'écran verrouillé et la cloche racontent la même histoire ; le code PIN ne
quitte jamais l'app ; les missions ne se coupent pas.

## Backend — `lib/notify.js`

`notify(prisma, { userId, event, params, requestId, data, urgent, audience })`
résout la langue (`user.language`) et les préférences (`user.notifPrefs`),
puis envoie ce que l'événement déclare : cloche (`Notification` localisée,
`data = { event, family, audience, screen, requestId, threadId, toast }`),
socket `notification:received` (room `user:<id>`), push au niveau déclaré
(`time-sensitive` / `active` / `passive`, silencieux en plage de silence).
50 événements fr/nl/en, familles `mission | message | money | account | news`.
Les 45 anciens `notifyUser` (textes français en dur) passent par lui ; restent
bruts l'escalade admin (support) et la diffusion admin (debug).

Préférences : `GET/PATCH /api/notifications/prefs` — `message`, `money`,
`account`, `news`, `quiet { enabled, from, to }`. `mission` n'est pas réglable.

## Mobile

- Routage : `classifyNotification` lit `data.event` / `audience` / `screen`
  (catalogue) et garde le repli sur `category` / `type` (anciennes).
- La cloche (`app/notifications.tsx`, `components/notifications/NotifRow`,
  `lib/notifications/model.ts`) : sections par jour, familles (ambre · vert ·
  gris), non-lu = point + graisse, puce « SUIVRE · MISSION #47 », tap = la
  destination re-résolue contre l'état courant, appui long = détail, glisser =
  supprimer, « Tout lu » via `/read-all`, vide honnête.
- Premier plan : `notification:received` → `feedback.notif()` (toast depuis
  l'île, fond vert pour l'argent, action « Voir » / « Répondre ») sauf
  `data.toast === false` (l'écran montre déjà l'événement). La bannière
  système se tait pour un événement du catalogue quand le socket est là
  (`lib/socketStatus.ts`), et reste sinon.
- Préférences (`app/settings/notifications.tsx`) : trois familles + silence,
  missions verrouillées ; réglages de retour (son, haptique, animations) en bas.

## Limites connues

- Le fil par mission sur l'écran verrouillé (`threadId`) est porté dans
  `data` mais Expo Push n'expose pas `thread-id` APNs : le regroupement
  attend SDK 58 (`threadIdentifier`).
- Les heures de silence sont fixes (22:00 – 07:00) dans l'app ; l'API accepte
  d'autres bornes.
