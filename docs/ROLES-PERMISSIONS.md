# Matrice des rôles et permissions

L’application dispose de 4 rôles : **admin**, **coordinator**, **volunteer**, **auditor**.

## Rôles

| Rôle           | Description |
|----------------|-------------|
| **admin**      | Accès complet : utilisateurs, audit, configuration (catégories, articles), export, import, purge, métriques. |
| **coordinator**| Opérations terrain et coordination : familles, besoins, aides, notes, documents, export, import. Pas de gestion des utilisateurs ni de la configuration. |
| **volunteer**  | Bénévole : créer/lire/modifier familles, enfants, besoins, aides, notes. Pas de suppression (sauf si ajouté plus tard), pas d’accès aux documents sensibles ni à l’audit. |
| **auditor**    | Lecture seule : tableau de bord, familles (lecture), journal d’audit (lecture). Aucune action d’écriture. |

## Permissions par ressource

| Action / Ressource        | admin | coordinator | volunteer | auditor |
|---------------------------|-------|-------------|-----------|---------|
| **Utilisateurs** (CRUD)   | ✅    | ❌          | ❌        | ❌      |
| **Journal d’audit** (lecture) | ✅ | ❌          | ❌        | ✅      |
| **Journal d’audit** (prune)   | ✅ | ❌          | ❌        | ❌      |
| **Métriques**             | ✅    | ❌          | ❌        | ❌      |
| **Catégories / Articles** (CRUD) | ✅ | ❌     | ❌        | ❌      |
| **Export**                | ✅    | ✅          | ❌        | ❌      |
| **Import familles**       | ✅    | ✅          | ❌        | ❌      |
| **Familles** (créer, modifier) | ✅ | ✅       | ✅        | ❌      |
| **Familles** (supprimer, purge, reset) | ✅ | ✅ (suppr) / ❌ (purge/reset) | ❌ | ❌ |
| **Enfants** (CRUD)        | ✅    | ✅          | ✅ (sans suppr) | ❌ |
| **Enfants** (supprimer)   | ✅    | ✅          | ❌        | ❌      |
| **Besoins** (créer, modifier) | ✅  | ✅       | ✅        | ❌      |
| **Besoins** (supprimer)   | ✅    | ✅          | ❌        | ❌      |
| **Aides** (créer)         | ✅    | ✅          | ✅        | ❌      |
| **Aides** (supprimer)     | ✅    | ✅          | ❌        | ❌      |
| **Notes de visite**        | ✅    | ✅          | ✅        | ❌      |
| **Documents famille**     | ✅    | ✅          | ❌        | ❌      |
| **Dashboard** (lecture)   | ✅    | ✅          | ✅        | ✅      |
| **Recherche**             | ✅    | ✅          | ✅        | ✅      |

## Implémentation technique

- Les routes sont protégées par `requireAuth` puis, selon le cas :
  - `requireAdmin` : admin uniquement (users, audit prune, metrics, categories, articles, purge, reset).
  - `requireRole("admin", "coordinator")` : suppression familles/enfants/besoins/aides, documents, export, import.
  - `requireRole("admin", "auditor")` : lecture du journal d’audit.
  - `requireCanWrite` (= `requireRole("admin", "coordinator", "volunteer")`) : toute écriture (création, modification) ; exclut l’auditeur.

Voir `server/index.ts` pour l’attribution des middlewares aux routes.
