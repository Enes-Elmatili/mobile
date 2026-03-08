# FIXED — Application Mobile

Application React Native / Expo — marketplace de services à domicile deux faces (clients ↔ prestataires).

**Dernière mise à jour : 27 février 2026**

---

## Vue d'ensemble MVP

| Rôle | Flux principal |
|------|----------------|
| **Client** | Inscription → Créer une demande → Matcher un prestataire → Suivre la mission → Payer → Évaluer |
| **Prestataire** | Inscription → Se mettre en ligne → Accepter une demande → Naviguer → Terminer → Toucher |

---

## Prérequis

| Outil | Version | Installation |
|-------|---------|-------------|
| Node.js | ≥ 20 | https://nodejs.org |
| npm | ≥ 10 | Inclus avec Node |
| Expo CLI | dernière | `npm i -g expo-cli` |
| Expo Go | dernière | App Store / Google Play |
| ngrok | dernière | https://ngrok.com/download |

> **Appareil physique requis.** Google Maps et la localisation ne fonctionnent pas dans le simulateur Expo Go.

---

## Étape 1 — Démarrer le backend

### 1.1 Installer les dépendances

```bash
cd backend
npm install
```

### 1.2 Appliquer les migrations et seeder la base

```bash
npx prisma migrate deploy
npx prisma db seed
```

Cela crée la base SQLite `backend/prisma/dev.db` et la seed avec :
- Un compte admin : `admin@mosaic.com` / `Mosaic@2025`
- Les catégories de services (plomberie, électricité, nettoyage…)
- Des prestataires et rôles d'exemple

### 1.3 Démarrer le serveur

```bash
npm run dev
```

L'API est disponible sur `http://localhost:3000`. Vous devriez voir :

```
Server running on http://0.0.0.0:3000
Socket.IO attached
```

---

## Étape 2 — Exposer le backend via ngrok

L'application mobile sur votre téléphone a besoin d'une URL publique pour atteindre le backend local.

### 2.1 Dans un nouveau terminal

```bash
ngrok http 3000
```

### 2.2 Copier l'URL de transfert

ngrok affichera quelque chose comme :

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

Copier l'URL `https://...ngrok-free.app`.

---

## Étape 3 — Configurer l'application mobile

### 3.1 Éditer `mobile/.env`

```bash
cd mobile
```

Modifier `.env` et coller l'URL ngrok :

```env
EXPO_PUBLIC_API_URL=https://VOTRE_URL_NGROK.ngrok-free.app/api
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<votre_clé_google_maps>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

> Pour utiliser votre **IP locale** à la place de ngrok (appareils sur le même Wi-Fi) :
> ```env
> EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api
> ```
> Trouver votre IP avec `ipconfig getifaddr en0` (macOS) ou `ipconfig` (Windows).

### 3.2 Installer les dépendances

```bash
npm install
```

### 3.3 Démarrer Expo

```bash
npx expo start
```

Un QR code apparaîtra dans le terminal et une fenêtre de navigateur s'ouvrira.

---

## Étape 4 — Ouvrir l'application sur votre appareil

1. Ouvrir l'application **Expo Go** sur votre iPhone ou Android.
2. Scanner le QR code affiché dans le terminal.
3. L'application se bundle et se lance — environ 30 secondes au premier chargement.

Vous devriez voir l'**écran de bienvenue FIXED**.

---

## Étape 5 — Tester les flux MVP

### Flux A : Parcours Client

**Objectif :** Créer une demande de service et suivre un prestataire en temps réel.

| Étape | Écran | Action |
|-------|-------|--------|
| 1 | Bienvenue | Appuyer sur **Démarrer** |
| 2 | Inscription | Créer un compte client (rôle : **Client**) |
| 3 | Dashboard Client | Voir les catégories et l'historique des demandes |
| 4 | Nouvelle demande | Appuyer sur **+** → Formulaire multi-étapes |
| 5 | Stepper | Choisir catégorie → Décrire le problème → Ajouter photos → Localisation → Confirmer |
| 6 | Dashboard | Demande en statut **PENDING** — en attente d'un prestataire |
| 7 | Onglet Missions | Voir le statut de la demande en live |
| 8 | Écran de suivi | Quand un prestataire accepte → carte avec suivi temps réel |
| 9 | Évaluation | Après la mission, noter le prestataire (1–5 étoiles) |
| 10 | Wallet | Consulter le solde et l'historique des transactions |

---

### Flux B : Parcours Prestataire

**Objectif :** Se mettre en ligne, recevoir une demande et compléter une mission.

> Utiliser un second appareil ou une seconde session Expo Go avec un compte séparé.

| Étape | Écran | Action |
|-------|-------|--------|
| 1 | Inscription | Créer un compte prestataire (rôle : **Provider**) |
| 2 | Dashboard Prestataire | Activer le toggle de statut → se mettre **EN LIGNE** |
| 3 | Attente | Le backend broadcast les demandes proches toutes les 45 secondes |
| 4 | Notification | Une alerte de nouvelle demande apparaît — appuyer pour voir les détails |
| 5 | Fiche mission | Consulter les détails, la localisation du client et le prix |
| 6 | Accepter | Appuyer sur **Accepter** — statut de la mission → **EN COURS** |
| 7 | Écran en cours | Carte de navigation vers le client |
| 8 | Terminer | Appuyer sur **Terminer la mission** quand c'est fait |
| 9 | Gains | Voir le paiement et demander un retrait depuis l'écran Gains |

---

### Flux C : Admin (API / Web)

Le backend expose une Swagger UI pour inspecter tous les endpoints :

```
http://localhost:3000/api-docs
```

Identifiants admin :
```
Email    : admin@mosaic.com
Mot de passe : Mosaic@2025
```

Endpoints clés à tester via Swagger ou un client REST (ex. Insomnia) :

| Endpoint | Objectif |
|----------|----------|
| `POST /api/auth/login` | Obtenir un token JWT |
| `GET /api/users` | Lister tous les utilisateurs |
| `GET /api/requests` | Lister toutes les demandes |
| `GET /api/providers` | Lister les prestataires avec leur statut |
| `GET /api/stats` | Statistiques du dashboard |
| `GET /api/wallet` | Soldes des wallets |
| `GET /api/stats/requests.csv` | Exporter les demandes en CSV |

---

## Structure de l'application

```
mobile/
├── app/
│   ├── _layout.tsx              ← Layout racine + garde d'auth
│   ├── index.tsx                ← Écran de bienvenue / splash
│   ├── (auth)/                  ← Bienvenue, Login, Inscription
│   ├── (tabs)/                  ← Dashboard, Missions, Profil, Documents
│   ├── request/
│   │   ├── NewRequestStepper.tsx ← Formulaire multi-étapes
│   │   ├── list.tsx             ← Historique des demandes
│   │   └── [id]/
│   │       ├── index.tsx        ← Détail demande
│   │       └── missionview.tsx  ← Suivi mission (Socket.IO)
│   ├── providers/               ← Liste et profils prestataires
│   └── wallet.tsx               ← Solde et transactions
├── components/                  ← UI réutilisable (cards, sheets, boutons)
│   ├── sheets/                  ← Dialogs bottom-sheet
│   └── ui/                      ← Primitives UI
├── lib/
│   ├── api.ts                   ← Client Axios avec refresh JWT
│   ├── auth/AuthContext.tsx     ← État d'authentification
│   ├── SocketContext.tsx        ← Provider Socket.IO temps réel
│   ├── storage.ts               ← Expo Secure Store
│   └── config.ts                ← Configuration & env
├── hooks/                       ← Custom React hooks
├── constants/                   ← Thème et configuration
└── .env                         ← URL API, clé Maps, clé Stripe
```

---

## Dépendances principales

| Catégorie | Librairie | Version |
|-----------|----------|---------|
| Framework | React Native + Expo | 0.81.5 / 54.0.33 |
| Navigation | Expo Router | 6.0.23 |
| HTTP | Axios | 1.13.2 |
| Temps réel | Socket.IO client | 4.8.3 |
| Paiements | @stripe/stripe-react-native | 0.50.3 |
| Cartes | react-native-maps | 1.20.1 |
| Géolocalisation | expo-location | 19.0.8 |
| Formulaires | react-hook-form | 7.69.0 |
| Stockage sécurisé | expo-secure-store | 15.0.8 |
| Animations | react-native-reanimated | 4.1.1 |
| Bottom sheets | @gorhom/bottom-sheet | 5.2.8 |
| Icônes | @expo/vector-icons | 15.0.3 |

---

## Résolution de problèmes

| Problème | Solution |
|---------|---------|
| "Network Error" | Vérifier que ngrok tourne et que l'URL dans `.env` est correcte. Redémarrer Expo après modification de `.env`. |
| Carte non chargée | La clé Google Maps API doit être activée pour Maps SDK (iOS + Android) dans la Google Cloud Console. |
| QR code non scannable | S'assurer que le téléphone et l'ordi sont sur le même Wi-Fi, ou utiliser le mode tunnel : `npx expo start --tunnel` |
| Socket non connecté | Le serveur Socket.IO backend doit être en marche. Vérifier que `http://localhost:3000` répond. |
| Erreur DB au démarrage | Relancer `npx prisma migrate deploy` depuis le dossier `backend/`. |
| Écran blanc / crash | Consulter le terminal Expo pour les erreurs. Le plus fréquent : valeurs `.env` manquantes ou URL API incorrecte. |

---

## État actuel (Audit 27/02/2026)

```
DEMO-READY          ████████████████████░░░░░░░░░░  ~65%
PRODUCTION-READY    ████████░░░░░░░░░░░░░░░░░░░░░░  ~25%
```

| Domaine | Statut | Notes |
|---------|--------|-------|
| API Backend | Fonctionnel | 35 modules de routes, Prisma ORM, Socket.IO |
| Auth (login/signup) | Fonctionnel | JWT avec refresh, stockage sécurisé |
| Flux client (création de demande) | Fonctionnel | Stepper multi-étapes, localisation, photos |
| Acceptation / complétion prestataire | Fonctionnel | Broadcast Socket, machine à états mission |
| Suivi temps réel | Fonctionnel | Mises à jour localisation Socket.IO, carte |
| Paiements Stripe | Mode test | Clés test, pas de setup clé live |
| Système Wallet | Fonctionnel | Crédit/débit/hold/release, transactions |
| Édition de profil | Non implémenté | Tous les boutons → "en développement" |
| Documents / Factures | Non implémenté | PDF non câblé (backend génère, front TODO) |
| Messagerie in-app | Non implémenté | TODO dans `missionview.tsx:649` |
| Notifications push | Non implémenté | Tokens Expo push non configurés |
| Admin panel (mobile) | Non implémenté | API admin complète, pas d'UI mobile |
| Tests | Aucun | `backend/tests/` vide, 0% couverture |
| Déploiement production | Aucun | Pas de Dockerfile, pas de CI/CD, pas d'env prod |

---

## Road to Production

### Problèmes critiques — À corriger avant tout utilisateur réel

- [ ] **Supprimer le bypass MASTER_KEY**
  - `backend/middleware/auth.js` — supprimer entièrement le bypass header `x-master-key`
  - Retirer `MASTER_KEY` du `.env`
  - Le commentaire dans le code dit "jamais en prod" — il est actuellement actif

- [ ] **Supprimer la clé Stripe hardcodée du code source**
  - `mobile/app/_layout.tsx` ligne 16 — clé publishable Stripe codée en dur
  - Utiliser `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (déjà dans `.env`, pas encore utilisée dans le layout)

- [ ] **Supprimer l'URL ngrok hardcodée du code source**
  - `mobile/lib/api.ts` ligne 4 — fallback URL pointe vers un tunnel ngrok personnel
  - Lever une erreur si `EXPO_PUBLIC_API_URL` n'est pas défini au lieu de tomber silencieusement

- [ ] **Sécuriser le fallback JWT_SECRET**
  - `backend/routes/auth.js` et `backend/middleware/auth.js` tombent sur `"dev"` si `JWT_SECRET` absent
  - Remplacer par : `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required')`

- [ ] **Rotation de toutes les clés API** (committées dans le dépôt)
  - Clé Google Maps API
  - Clés Stripe test (secret et publishable)
  - Générer un nouveau `JWT_SECRET` fort pour la production

- [ ] **Créer les fichiers `.env.example`** (dans `backend/` et `mobile/`) avec des valeurs placeholder sans vrais secrets

- [ ] **Assigner le rôle à l'inscription**
  - `backend/routes/auth.js` — les nouveaux utilisateurs sont créés sans rôle, les bloquant sur toutes les routes protégées
  - Récupérer le rôle CLIENT ou PROVIDER par son nom et l'attacher au moment de l'inscription

---

### Haute priorité — Bloque un demo ou bêta crédible

- [ ] **Implémenter l'édition de profil**
  - `mobile/app/(tabs)/profile.tsx` — tous les boutons appellent `wip()` placeholder
  - Infos personnelles, téléphone, coordonnées bancaires, préférences notifs → tout renvoie "en développement"

- [ ] **Câbler le téléchargement de factures / documents**
  - `mobile/components/sheets/TicketDetailSheet.tsx` ligne 260 — `handleInvoice()` est un TODO
  - Le backend génère les PDF via pdfkit — connecter l'URL de téléchargement à `Linking.openURL()`

- [ ] **Implémenter la messagerie in-app**
  - `mobile/app/request/[id]/missionview.tsx` ligne 649 — envoi de message est un TODO
  - Le backend a un modèle `Message` dans Prisma — l'API et la couche socket sont prêtes à être câblées

- [ ] **Implémenter la soumission d'avis**
  - `TicketDetailSheet.tsx` ligne 254 — `handleRate()` est un commentaire TODO
  - L'endpoint `POST /api/requests/:id/rating` existe — l'appeler

- [ ] **Supprimer tous les `console.log` des builds production**
  - 70+ instances dans `lib/api.ts`, `SocketContext.tsx`, `AuthContext.tsx`
  - Ajouter un plugin babel (`babel-plugin-transform-remove-console`) ou entourer de `if (__DEV__)`

- [ ] **Ajouter les notifications push**
  - Installer `expo-notifications`, enregistrer le token appareil à la connexion
  - Le backend a besoin d'un champ `pushToken` sur User et d'un helper de notification
  - Déclencheurs clés : demande matchée, prestataire accepté, mission terminée

- [ ] **Implémenter le flux de re-commande**
  - `TicketDetailSheet.tsx` ligne 265 — `handleReorder()` est un TODO
  - Doit pré-remplir NewRequestStepper avec la catégorie et la description précédentes

---

### Moyenne priorité — Requis pour soumission App Store

- [ ] **Passer la base de données de SQLite à PostgreSQL**
  - `backend/prisma/schema.prisma` utilise `provider = "sqlite"`
  - SQLite n'a pas de support d'écriture concurrente — échouera sous n'importe quelle charge réelle
  - Mettre à jour le schéma vers `provider = "postgresql"`, mettre à jour `DATABASE_URL`

- [ ] **Compléter la configuration EAS build**
  - `mobile/eas.json` est quasi vide — pas de profil production, pas de secrets d'environnement
  - Ajouter un profil `production` avec `autoIncrement: true` et les secrets EAS pour toutes les vars d'env
  - Configurer le profil `submit` pour App Store Connect et Google Play

- [ ] **Ajouter le rate limiting sur les routes auth**
  - `backend/routes/auth.js` — login et signup n'ont pas de protection brute-force
  - Ajouter le middleware `express-rate-limit` sur `POST /api/auth/login`

- [ ] **Ajouter la surveillance d'erreurs (Sentry)**
  - Backend : `@sentry/node` sur le gestionnaire d'erreurs Express
  - Mobile : `@sentry/react-native` dans `app/_layout.tsx`
  - Sans ça, les crashs en production sont invisibles

- [ ] **Ajouter les logs d'audit admin pour les actions prestataires**
  - `backend/routes/admin.providers.js` lignes 116, 138 — suspend/activate ont des commentaires TODO audit log
  - Le modèle `AdminActionLog` existe déjà dans Prisma — juste écrire dedans

- [ ] **Renforcer la validation des mots de passe**
  - `backend/routes/auth.js` utilise `z.string().min(6)` — accepte "123456"
  - Ajouter regex : au moins une majuscule, un chiffre, un caractère spécial

- [ ] **Corriger les champs optionnels qui devraient être requis**
  - `Request.price` — peut être null, cassera le flux de paiement
  - `User.phone` — les prestataires ont besoin d'un numéro de contact
  - `Provider.email` — ajouter la contrainte `@unique`

---

### Basse priorité — Polissage post-lancement

- [ ] **Écrire des tests**
  - `backend/tests/` existe mais est vide
  - Commencer par les endpoints auth et le flux de création + matching de demandes
  - Utiliser Jest + Supertest pour le backend

- [ ] **Supprimer les casts TypeScript `any`**
  - 26+ instances dans les écrans mobile
  - Empêche la détection de bugs à la compilation

- [ ] **Ajouter un pipeline CI/CD**
  - Créer `.github/workflows/ci.yml`
  - Lancer lint + tests sur chaque PR
  - Déclencher un build EAS sur merge vers `main`

- [ ] **Ajouter un Dockerfile pour le backend**
  - Nécessaire pour tout déploiement cloud (Railway, Render, Fly.io, AWS)
  - Inclure `prisma migrate deploy` dans la commande de démarrage

- [ ] **Localisation / i18n**
  - `backend/i18n/` existe mais l'UI mobile est codée en dur en français
  - Décider : MVP français uniquement ou ajouter i18n dès le départ

---

## Ordre des sprints suggéré

```
Sprint 1 — Sécurité & Auth (3–4 jours)
  Supprimer le bypass MASTER_KEY
  Corriger le fallback JWT
  Assigner les rôles à l'inscription
  Rotation et externalisation de tous les secrets

Sprint 2 — Complétion UX (5–7 jours)
  Édition de profil
  Téléchargement factures
  Soumission d'avis
  Messagerie in-app (basique)
  Supprimer les console.logs

Sprint 3 — Infrastructure production (3–5 jours)
  Migrer DB vers PostgreSQL
  Configurer le build EAS production
  Ajouter Sentry
  Déployer le backend sur cloud (Railway / Render)

Sprint 4 — Soumission stores (3–4 jours)
  Compléter les métadonnées app.json
  EAS build + submit
  Listing App Store / Play Store
  TestFlight / track interne

Sprint 5 — Consolidation (continu)
  Ajouter notifications push
  Écrire des tests
  Ajouter CI/CD
  Rate limiting
```

---

## Vérification rapide

Exécuter après chaque changement majeur pour vérifier que le flux core fonctionne encore :

```bash
# 1. Backend en vie
curl http://localhost:3000/api/

# 2. Auth fonctionnel
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mosaic.com","password":"Mosaic@2025"}'

# 3. Catégories chargées (utilisées par NewRequestStepper)
curl http://localhost:3000/api/categories \
  -H "Authorization: Bearer <token_de_l_étape_2>"

# 4. Liste des prestataires
curl http://localhost:3000/api/providers \
  -H "Authorization: Bearer <token_de_l_étape_2>"
```



