# Gains : le relevé (planche B)

Date : 14/09/2026 · Décision d'Enès : direction B (« le relevé, la banque d'abord »), mois passés repliés sous le mois courant. Planches : artefact « Chaque chiffre est un fait Stripe ».

## Thèse

Le portefeuille est une projection des virements Stripe faits à la complétion ; Stripe dépose sur le compte bancaire du prestataire (quotidien, sous 7 jours). La page dit donc, dans cet ordre : **ce qui arrive sur mon compte et quand**, **ce qui est arrivé**, puis **mission par mission** ce que j'ai gagné. Tout ce qui n'a plus de fait derrière disparaît : retraits, « en validation », « libéré », solde de repli, « 20 % » en dur.

## Chemin argent

Aucune modification des charges, transferts ni virements. Côté serveur, uniquement de la lecture et de la projection :
- `WalletTransaction.requestId Int?` (**nouveau champ Prisma**, index) : posé par `applyTransferCreated/Reversed` depuis `transfer.metadata.requestId` ; la table est vide en prod, pas de reprise.
- `GET /wallet` renvoie en plus `month: { net, missions, from }` (Σ CREDIT − DEBIT du mois civil courant, nombre de missions distinctes), `commissionRate` (taux courant du prestataire via `commissionRateForProvider`), `currency: 'eur'`. Montants en centimes comme le reste de la réponse.
- `GET /wallet/txs` renvoie chaque transaction enrichie de `mission: { id, serviceName, categorySlug, address, completedAt, gross, commissionRate, net } | null` (gross/net en centimes ; `commissionRate` = snapshot `Request.commissionRate`).
- `GET /connect/balance` renvoie en plus `payouts` (12 derniers : `{ id, amount, status, arrivalDate, createdAt }`) et `bank: { last4, name } | null` (`account.external_accounts`).
- `POST /wallet/debit` réservé aux ADMIN (un prestataire pouvait débiter sa propre projection).

## Écran Gains (`app/(tabs)/wallet.tsx`, refait)

1. **En-tête** : « Gains » + sous-titre « Virement quotidien sur BE71 ···· 4821, sous 7 jours. » (calendrier + banque depuis `connect/balance`). Si Stripe n'est pas prêt : sous-titre « Configurez vos virements pour recevoir vos gains » et la carte banque devient l'action.
2. **Segment** Missions | Virements.
3. **Cartes banque** (segment Missions) : « X € en route vers votre compte · Arrive jeu. 18 sept. · n missions » (transactions dont l'arrivée estimée est à venir, ou Stripe `pending` > 0) ; « X € virés lun. 8 sept. · n missions » (dernier virement Stripe). Arrivée estimée d'une mission = `createdAt` du crédit + `payoutSchedule.delayDays` (repli 7 j), jours ouvrés non comptés (Stripe compte en jours calendaires pour ce compte).
4. **Mois** : blocs `MOIS · n MISSIONS` avec le net à droite ; le mois courant est ouvert, les autres repliés (tap pour ouvrir). Une ligne par mission : icône catégorie, prestation · commune, date, net `+245 €`, état mono : `ARRIVE JEU. 18` / `VIRÉ` / `REMBOURSÉ` (débit). Les transactions sans mission (crédit admin, ancienne référence) s'affichent avec leur libellé brut, jamais cachées.
5. **Segment Virements** : la liste des payouts Stripe, une ligne chacun (montant, date d'arrivée, statut), et le calendrier.
6. **Fiche argent** (tap sur une ligne, `feedback`-style sheet gorhom) : `MISSION #43 · SAM. 13 SEPT.`, prestation · commune, bloc trois lignes (Payé par le client / Commission FIXED · taux réel / Votre net), chronologie (terminée, virement parti, arrive sur BE71 ···· 4821 le …), bouton « Voir la facture » si facture.
7. **États vides** : Stripe pas prêt → carte banque = « Configurer mes virements » ; Stripe prêt sans mission → « Votre première mission payée apparaîtra ici » + « Passer en ligne » (retour au dashboard prestataire).
8. **Menu** : « Gérer mes paiements » (tableau de bord Stripe Express) et « Mes factures » restent, dans un menu ⋯ en haut à droite.

## Fin de mission (`app/request/[id]/earnings.tsx`)

Net en héros (DigitReel), libellé « NET · ARRIVE JEU. 18 SUR VOTRE COMPTE », le même bloc trois lignes (taux réel de la mission, `brief.money`), trois mini-faits (ce mois — lu sur `wallet.month.net`, missions du mois, note), CTA « Ma prochaine mission », lien facture. Plus de compteur par `setInterval`.

## Ce qui part

Filtres Retraits / En attente, `WithdrawRow`, `WD_STATUS_CFG`, `consolidateTxs`, `readableLabel`, appels `wallet.withdraws`, clés i18n de retrait (`wallet.withdraw*`, `ext.wallet_withdraw_*`, `wallet_request_sent*`, `wallet_in_validation`, `wallet_in_withdrawal`), `NET_RATE`/`* 0.8` mobiles remplacés par `netFor(brief)` ou le net serveur, helpers de date dupliqués → `lib/format.ts` (`formatDay`, `formatMonth`).

## i18n

Namespace `gains.*` (fr/nl/en) : `title`, `schedule`, `schedule_no_bank`, `setup_sub`, `setup_cta`, `seg_missions`, `seg_payouts`, `in_transit`, `arrives`, `paid_out`, `missions_n`, `month_missions`, `arrive_short`, `paid_short`, `refunded_short`, `sheet_mission`, `paid_by_client`, `commission`, `your_net`, `tl_done`, `tl_transfer`, `tl_bank`, `view_invoice`, `empty_title`, `empty_sub`, `go_online`, `no_payouts`, `payout_status_*`, `menu_manage`, `menu_invoices`, `earn_kicker`, `earn_net_arrives`, `earn_month`, `earn_missions`, `earn_rating`, `earn_next`.

## Tests

- `lib/gains/*.ts` purs : regroupement par mois, arrivée estimée, état d'une ligne, bloc trois lignes depuis une transaction enrichie.
- backend : `applyTransferCreated` persiste `requestId` ; `/wallet` renvoie `month` ; `/wallet/txs` enrichit ; `/wallet/debit` refuse un PROVIDER.
