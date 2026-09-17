# Accueil prestataire — « Le GO »

Date : 2026-09-17. Prototype validé : artifact « Le GO » (synthèse des planches
« Le cockpit respire », « Le cockpit vit », « En ligne, sans écho »).

## Thèse

Un seul objet dit l'état. Le disque vert **GO** à cheval sur le dock = hors
ligne ; le petit carré « stop » à gauche du dock + la barre « Vous êtes en
ligne » = en ligne ; disparu = une demande ou une mission occupe l'écran. Rien
ne pulse, rien ne clignote, aucun halo. La carte est l'écran ; l'interface
flotte dessus.

## Stades (`lib/cockpit/stage.ts`, pur)

| Stade | Quand | Carte | Haut | Bas |
|---|---|---|---|---|
| `off` | hors ligne | voile sombre + « vous êtes invisible », « moi » gris | profil · aujourd'hui · messages · cloche | journée + dock muet + **GO** |
| `on` | en ligne | allumée, caméra sur moi, points ambre = demandes reçues, « moi » blanc | idem | journée + dock « Vous êtes en ligne · N demandes près de vous · chrono » + stop |
| `incoming` | première demande de la file | caméra moi + demande, itinéraire tracé, point ambre plus gros | effacé | fiche `IncomingMissionCard` (inchangée) |
| `busy` | mission acceptée active (`currentMission`) | caméra moi + porte, porte verte, « moi » = flèche de cap | idem `on` | carte mission blanche + dock ambre « Vous êtes occupé · Mission #id · chrono », **pas de stop** |
| `gps` | permission refusée | voile + « sans position, rien n'arrive », « moi » rouge | idem | carte rouge « Autoriser » + dock rouge, GO disparu |

Priorité : `busy` > `gps` > `off` > `incoming` > `on`.

## Composants (`components/cockpit/`)

- `GoButton` — un `p` partagé 0→1 (ressort `MOTION.unfold`) interpole position,
  taille, bord, couleur ; `shown` pour disparaître. Haptique `medium` à l'appui
  du GO (même frame que le départ).
- `Dock` — liste · état · réglages. Chrono `onlineSince` (local, posé au
  passage en ligne), n'existe qu'en ligne.
- `TopRow` — pastille « aujourd'hui » en `DigitReel`, éclat vert + haptique
  `success` quand le montant monte (clôture).
- `DayStrip` — rappels (`remindersOf`), prochaine mission (`nextMissionOf`,
  ambre à < 30 min), trois tuiles : **ce mois** (+ en attente), **note**
  (+ missions), **rang** (+ % acceptées). Rien de l'ancien îlot n'est perdu.
- `MissionCard`, `GpsCard`, `Veil`, `markers` (MeMarker / DemandDot / DoorMarker).

## Données

- Backend : `GET /provider/dashboard` → `stats.todayEarnings` (même agrégat que
  le mois, borne = minuit) ; `provider.acceptanceRate` (existait, jamais lu).
  `GET /providers/missions` → `client.name`, `lat`, `lng` en plus.
- Mobile : aucune nouvelle route. Demandes = `incomingRequests` (socket
  `new_request` + `/requests/incoming`), mission = `currentMission`, journée =
  `missions` + `connect`.

## Caméra

`useMapCamera` mode `me` avec `door = ma position`, `other = demande | porte`
; `mapPadding` sur la MapView (haut = rangée du haut, bas = zone couverte),
`sheetHeight: 0` pour ne pas compter deux fois. Hors ligne / sans GPS :
`none`, la carte ne bouge pas.

## Ce qui ne bouge pas

`SocketContext`, accept/refuse (REST + socket), la file et son polling,
`IncomingMissionCard`, `providerGate`. Aucune modification du chemin argent.

## Vérification

`__tests__/cockpit.test.js` (stades, caméra, GO, rappels, prochaine mission,
kicker) ; backend `tests/providerDashboardToday.test.js` ; garde worklet ;
`tsc`, eslint, jest, backend `npm test`. Test appareil : off → GO → demande →
glisser → occupé → clôture → retour en ligne → GPS refusé → Autoriser.
