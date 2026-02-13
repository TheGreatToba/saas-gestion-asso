# Roadmap – Étapes restantes (détaillées)

Ce document détaille les étapes à réaliser après les correctifs déjà appliqués (export N+1, schéma memberCount, file_data nullable, CI, interface rate-limit). Référence : `contexte.txt` et analyse comparative code/contexte.

---

## Légende statut

- **Fait** : déjà implémenté
- **À faire** : détaillé ci-dessous
- **Partiel** : commencé, à compléter

---

## 🔴 Priorité 1 – Urgent (0–4 semaines)

### 1.1 Vérification email à l’inscription

**Objectif** : Éviter les comptes non vérifiés (spam, typo). Double opt-in : inscription → email avec lien → clic pour activer le compte (ou confirmer l’email).

**Où** :
- **Backend** : `server/routes/auth.ts` (register), nouveau handler type `GET /api/auth/confirm-email?token=...`
- **Shared** : `shared/schema.ts` – pas de changement schéma user si on garde `active` ; optionnel : champ `email_verified_at` ou `pending_email_token`
- **Stockage** : table dédiée ou colonnes sur `users` : token de confirmation (hashé ou opaque), expiration (ex. 24 h). Ex. `email_verification_tokens (user_id, token_hash, expires_at)` ou colonnes `pending_email_token`, `pending_email_expires_at` sur `users`
- **Envoi d’email** : nouveau module `server/email.ts` (ou service externe) avec template “Confirmez votre email” + lien contenant le token. Variable d’env : `SMTP_*` ou `EMAIL_FROM`, `EMAIL_PROVIDER`, etc.

**Étapes** :
1. Créer migration : table `email_verification_tokens` (id, user_id, token_hash, expires_at) ou colonnes sur `users`.
2. À l’inscription : créer le token, ne pas mettre `active = true` ; envoyer l’email (lien vers front `/confirm-email?token=...`).
3. Route `GET /api/auth/confirm-email` : vérifier token, expirer le token, passer `active = true` (ou marquer email vérifié).
4. Page client `client/pages/ConfirmEmail.tsx` + route dans `App.tsx` : appel à l’API avec le token depuis l’URL, affichage succès/erreur.
5. Documenter dans `.env.example` les variables d’email.

**Critères de fin** : Inscription sans clic sur le lien = compte inactif ; après clic = compte actif (ou email_verified). Email envoyé (ou log en dev si pas de SMTP).

---

### 1.2 Invitation par un admin (création de compte)

**Objectif** : Seuls les admins peuvent “inviter” un nouvel utilisateur (email + rôle). L’invité reçoit un lien pour définir son mot de passe et activer son compte.

**Où** :
- **Backend** : `server/routes/users.ts` – remplacer ou compléter “création directe” par “création d’invitation”. Nouvelle route ex. `POST /api/users/invite` (admin only) : body `{ email, role, name? }` → créer user avec `active = false`, pas de mot de passe (ou token temporaire), générer token d’invitation, envoyer email avec lien.
- **Table** : réutilisation de `email_verification_tokens` ou table `invitations (id, user_id, token_hash, expires_at)`.
- **Route** : `GET /api/auth/accept-invite?token=...` ou `POST /api/auth/set-password` avec token : accepter token, permettre de set le mot de passe, activer le compte.
- **Front** : page “Accepter l’invitation” (`/accept-invite?token=...`) : formulaire mot de passe + confirmation, appel API, puis redirection login.
- **Front** : écran Users : bouton “Inviter” au lieu (ou en plus) de “Créer utilisateur”, formulaire email + rôle, appel `POST /api/users/invite`.

**Étapes** :
1. Décider si inscription publique reste possible (option désactivable via env `ALLOW_PUBLIC_REGISTRATION=false`) ou si tout passe par invitation.
2. Implémenter `POST /api/users/invite` + envoi email avec lien d’invitation.
3. Implémenter `GET /api/auth/accept-invite` (ou set-password) + activation compte.
4. Page client accept-invite + adaptation page Users (invitation).

**Critères de fin** : Admin peut inviter par email ; l’invité reçoit un email et peut définir son mot de passe une seule fois ; compte actif après acceptation.

---

### 1.3 Rate limit avec Redis (scale horizontal)

**Objectif** : En déploiement multi-instances, le rate limit login doit être partagé (Redis) pour rester efficace.

**Où** :
- **Backend** : `server/rate-limit.ts` – l’interface `RateLimitStore` existe ; ajouter une implémentation `RedisRateLimitStore` qui utilise les clés `rate:{name}:{key}` avec TTL (window) et compteur (INCR + EXPIRE ou script Lua pour fenêtre glissante).
- **Démarrage** : dans `server/index.ts`, si `process.env.RATE_LIMIT_REDIS_URL` est défini, créer le store Redis et appeler `setRateLimitStore(redisStore)` avant de monter les routes.
- **Dépendance** : `ioredis` ou `redis` (client Node). Ajouter en optional ou dev si on veut éviter de casser les installs sans Redis.

**Étapes** :
1. Ajouter `ioredis` (ou `redis`) en dépendance.
2. Créer `server/rate-limit-redis.ts` : classe ou objet qui implémente `RateLimitStore`, avec get/set basés sur Redis (structure de bucket sérialisée en JSON ou champs séparés).
3. Dans `server/index.ts`, au démarrage : si `RATE_LIMIT_REDIS_URL` présent, instancier le client Redis et le store, puis `setRateLimitStore(redisStore)`.
4. Tester avec Redis local (ex. Docker) et vérifier que le blocage login est bien partagé entre deux processus.

**Critères de fin** : Avec `RATE_LIMIT_REDIS_URL` défini, le rate limit login est partagé entre instances ; sans Redis, comportement inchangé (mémoire).

---

## 🟠 Priorité 2 – Important (1–3 mois)

### 2.1 Refactor storage : repositories + services

**Objectif** : Réduire la taille et la responsabilité de `server/storage.ts` en extrayant un repository (et optionnellement un service) par agrégat.

**Déjà fait** : `families` → `server/repositories/families.repository.ts` + `server/services/family.service.ts` ; `storage` les utilise pour familles, recherche, export partiel, dashboard.

**À faire** (ordre suggéré) :
1. **Needs** : créer `server/repositories/needs.repository.ts` (getByFamily, getByFamilyIds, getPage, create, update, delete, count). Puis faire appeler ce repo par `storage.ts` (remplacer les méthodes needs dans storage par des appels au repo). Optionnel : `server/services/need.service.ts` si règles métier (ex. scoring priorité).
2. **Aids** : idem `server/repositories/aids.repository.ts` (getByFamily, getByFamilyIds, getPage, create, delete, etc.), puis brancher dans storage.
3. **Children** : `server/repositories/children.repository.ts` (getByFamily, getByFamilyIds, create, update, delete), brancher dans storage.
4. **Users** : `server/repositories/users.repository.ts` (getById, getByEmail, getAllByOrg, create, update, countAdmins), garder l’auth (authenticate) dans storage ou la déplacer dans un `AuthService` qui utilise users.repository + passwords.
5. **Categories / Articles** : repositories si on veut homogénéiser ; sinon laisser en dernier.
6. **Audit / Documents** : soit dans storage encore un temps, soit `audit.repository.ts` et `documents.repository.ts` (ou stockage docs déjà dans object-storage, juste métadonnées en repo).

**Critères de fin** : `storage.ts` délègue la majorité des accès DB aux repositories ; sa taille diminue nettement ; les routes continuent de passer par `storage` ou par les services (au choix selon cohérence).

---

### 2.2 RBAC – Rôles (admin, coordinateur, bénévole, auditeur)

**Objectif** : Passer de 2 rôles (admin, volunteer) à au moins 4 avec des permissions différentes.

**Où** :
- **Shared** : `shared/schema.ts` – `UserRole = z.enum(["admin", "coordinator", "volunteer", "auditor"])` (ou noms métier). Mettre à jour les types et schémas (CreateUserSchema, UpdateUserSchema, etc.).
- **DB** : migration dans `server/db.ts` : `role TEXT NOT NULL CHECK (role IN ('admin', 'volunteer'))` → étendre à `('admin','coordinator','volunteer','auditor')`. Pour les lignes existantes : laisser `admin` et `volunteer` tels quels.
- **Backend** : middlewares dans `server/index.ts` : aujourd’hui `requireAdmin` ; ajouter ex. `requireRole('admin','coordinator')` pour les routes “coordination”, `requireRole('admin')` pour les routes sensibles (users, audit, config). Définir une matrice : qui peut faire quoi (créer famille, modifier besoin, voir audit, gérer users, etc.).
- **Front** : affichage et édition du rôle dans `client/pages/Users.tsx` (liste des 4 rôles), désactivation de boutons/onglets selon le rôle de l’utilisateur connecté (ex. masquer “Utilisateurs” et “Audit” pour bénévole).

**Étapes** :
1. Étendre l’enum rôle en shared + DB (migration + backfill si besoin).
2. Documenter la matrice de permissions (fichier `docs/ROLES-PERMISSIONS.md` ou commentaires).
3. Implémenter `requireRole(...roles)` et remplacer les `requireAdmin` par les bons `requireRole`.
4. Adapter l’UI (Users, menu, champs désactivés selon rôle).

**Critères de fin** : 4 rôles en DB et dans l’app ; les routes respectent les rôles ; un bénévole ne peut pas accéder aux écrans réservés aux admins/coordinateurs.

---

### 2.3 Multi-tenant côté produit (UI + isolation stricte)

**Objectif** : Les données sont déjà isolées par `organization_id` en backend. Il reste à : (1) s’assurer qu’aucune route ne renvoie de données d’une autre org ; (2) exposer la notion d’organisation dans l’UI si on vise plusieurs associations (choix d’org, paramètres d’org).

**Où** :
- **Backend** : Vérifier que chaque route qui lit/écrit des données utilise `res.locals.user.organizationId` (ou équivalent) et ne fait jamais de requête sans filtre `organization_id`. Audit de toutes les routes dans `server/index.ts` et `server/routes/*.ts`.
- **Organizations** : Table `organizations` existe. Si multi-tenant “produit” : routes `GET /api/organizations` (liste pour super-admin ?), `GET /api/organizations/current` (org de l’utilisateur), et éventuellement `PATCH /api/organizations/current` (nom, slug). Création d’org : selon produit (super-admin uniquement ou processus d’onboarding).
- **Front** : Si un utilisateur peut appartenir à une seule org : pas de sélecteur. Si futur “super-admin” ou multi-org : header ou settings avec choix d’organisation. Pour l’instant, garder un seul `org-default` et tout filtrer par `organizationId` du user.

**Étapes** :
1. Audit des routes : chaque handler qui touche families, needs, aids, users, etc. doit utiliser l’org du user ; corriger les oublis.
2. (Optionnel) Créer `GET /api/organizations/current` qui renvoie l’org du user (pour affichage nom d’association).
3. (Optionnel) Page paramètres “Association” (nom, logo) réservée admin.

**Critères de fin** : Aucune fuite de données entre organisations ; l’org du user est la seule source de filtrage.

---

### 2.4 UX mobile “intervention terrain” (low-friction)

**Objectif** : Réduire la charge cognitive sur mobile : parcours court, 3 actions principales (trouver famille, enregistrer aide, ajouter note), typo lisible, CTA clairs.

**Déjà en place** : Page `client/pages/Intervention.tsx` (recherche, aide, note). À renforcer.

**Où** :
- **Client** : `Intervention.tsx` – s’assurer que sur petit écran le flux est “1) recherche 2) sélection famille 3) bouton aide OU note” sans étapes superflues. Éviter les modales imbriquées ; préférer un seul écran à la fois ou un bottom sheet.
- **Global** : `client/global.css` et composants : revue des `text-xs` sur les écrans clés (Intervention, FamilyDetail, liste familles) ; augmenter taille de police ou contraste pour lisibilité terrain.
- **Navigation** : Lien “Intervention rapide” bien visible sur mobile (menu, raccourci, ou page d’accueil) pour que les bénévoles y accèdent en 1 clic.

**Étapes** :
1. Tester la page Intervention sur mobile (ou viewport étroit) ; simplifier le flux (moins de clics, moins de champs visibles d’un coup).
2. Identifier les blocs en `text-xs` sur Intervention + FamilyDetail + listes ; les passer en `text-sm` ou plus avec contraste suffisant.
3. Mettre un CTA “Intervention rapide” en évidence (sidebar, header ou dashboard).

**Critères de fin** : Parcours “trouver famille → enregistrer aide” en moins de 5 actions ; lisibilité améliorée sur mobile.

---

### 2.5 Observabilité (metrics, traces, audit externe)

**Objectif** : Avoir des métriques serveur, et optionnellement des traces et un export du journal d’audit vers un SIEM.

**Où** :
- **Métriques** : `server/metrics.ts` existe ; s’assurer que l’endpoint `/api/metrics` (admin) expose des compteurs utiles (requêtes, erreurs 4xx/5xx, temps). Optionnel : métriques métier (nombre de familles, aides par jour) pour tableaux de bord.
- **Traces** : Optionnel. Ajouter un traceur (ex. OpenTelemetry) avec span par requête et par opération critique (auth, export, upload). Sortie : console en dev, ou exporteur OTLP en prod.
- **Audit externe** : Route admin `GET /api/audit-logs/export?from=...&to=...` (CSV ou JSON) pour envoyer le journal à un outil externe ou à une équipe sécurité. Documenter le format et la rétention (voir `docs/SAUVEGARDE-RESTAURATION.md`).

**Étapes** :
1. Vérifier et compléter les métriques dans `metrics.ts` + endpoint.
2. (Optionnel) Mise en place d’OpenTelemetry ou équivalent.
3. Ajouter export audit (CSV/JSON) par plage de dates et documenter.

**Critères de fin** : Métriques exposées et utilisables ; possibilité d’exporter l’audit pour analyse externe.

---

## 🟢 Priorité 3 – Futur (3–6 mois)

### 3.1 Module interventions (workflow complet)

**Objectif** : Missions assignées à des bénévoles, statuts (à faire / en cours / fait), ETA terrain, checklists.

**Où** :
- **Schéma** : Nouvelles entités, ex. `interventions` (id, family_id, assigned_user_id, status, planned_at, started_at, completed_at, checklist_json ou table dédiée), éventuellement `intervention_tasks` pour les étapes.
- **Backend** : `server/repositories/interventions.repository.ts`, `server/routes/interventions.ts`, CRUD + changement de statut, liste “mes interventions” pour le bénévole.
- **Front** : Pages “Planning”, “Mes interventions”, détail d’une intervention (statut, ETA, checklist). Carte ou liste par zone si géo.

**Étapes** : À détailler au moment du sprint (modélisation, migrations, API, UI). Dépend de la priorité produit (SLA, équité, reporting).

---

### 3.2 KPI métier (temps de prise en charge, équité)

**Objectif** : Tableaux de bord avancés : délai moyen entre besoin déclaré et première aide, répartition des aides par zone/bénévole, alertes “famille sans visite depuis X jours”.

**Où** : Backend : requêtes agrégées (SQL ou via repositories) ; endpoints dédiés ou extension du dashboard. Front : graphiques (ex. Recharts) sur une page Reports ou Dashboard.

---

### 3.3 Conformité RGPD (exports, journal accès)

**Objectif** : Exports des données personnelles (famille, documents) pour exercice du droit à l’effacement / portabilité ; journal des accès aux données sensibles.

**Où** : Route(s) admin : export d’une famille (données + liste documents) en JSON/PDF ; endpoint “effacer famille” (anonymisation ou suppression + audit). Table ou log dédié “access_log” pour chaque consultation de fiche famille/document si exigence légale.

---

## Récapitulatif ordre suggéré

| Ordre | Étape | Priorité |
|-------|--------|----------|
| 1 | Vérification email | 🔴 |
| 2 | Invitation par admin | 🔴 |
| 3 | Rate limit Redis | 🔴 |
| 4 | Refactor storage (needs, aids, children) | 🟠 |
| 5 | RBAC 4 rôles | 🟠 |
| 6 | Audit multi-tenant (isolation stricte) | 🟠 |
| 7 | UX mobile intervention | 🟠 |
| 8 | Observabilité (metrics + export audit) | 🟠 |
| 9 | Module interventions (workflow) | 🟢 |
| 10 | KPI métier + RGPD | 🟢 |

---

*Document généré à partir de l’analyse contexte.txt et de l’état actuel du code. À mettre à jour au fur et à mesure des livraisons.*
