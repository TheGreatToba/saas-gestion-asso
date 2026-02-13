# Sauvegarde, restauration et rétention des données

Ce document décrit les procédures de sauvegarde de la base de données, la politique de rétention du journal d'audit et la restauration en cas d'incident.

---

## 1. Sauvegarde de la base de données

La base SQLite est stockée dans le répertoire `data/` à la racine du projet (ou du déploiement) :

- **Fichier principal :** `data/aide-famille.db`
- **Fichiers WAL (si mode WAL actif) :** `data/aide-famille.db-wal`, `data/aide-famille.db-shm`

### Sauvegarde manuelle

```bash
# Depuis la racine du projet / de l'application
mkdir -p backups
cp -a data/aide-famille.db* backups/
# Optionnel : nommer avec la date
cp -a data/aide-famille.db "backups/aide-famille-$(date +%Y%m%d-%H%M).db"
```

Pour un backup cohérent, il est préférable d'arrêter brièvement l'application ou d'utiliser la sauvegarde en ligne de SQLite (`sqlite3 .backup backups/backup.db`).

### Sauvegarde automatique (cron)

Exemple de script à exécuter quotidiennement (ex. `scripts/backup-db.sh`) :

```bash
#!/bin/bash
set -e
APP_DIR=/chemin/vers/aide-famille-hub
BACKUP_DIR="$APP_DIR/backups"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d-%H%M)
cp -a "$APP_DIR/data/aide-famille.db" "$BACKUP_DIR/aide-famille-$DATE.db"
# Nettoyer les sauvegardes de plus de RETENTION_DAYS jours
find "$BACKUP_DIR" -name "aide-famille-*.db" -mtime +$RETENTION_DAYS -delete
```

Ajouter dans crontab : `0 2 * * * /chemin/vers/scripts/backup-db.sh`

### Stockage objet (documents familles)

Si l'application utilise un stockage objet (S3 / MinIO) pour les documents (voir `OBJECT_STORAGE_*`), les sauvegardes doivent être gérées côté bucket (versioning, politique de rétention, sauvegarde cross-région selon votre hébergeur).

---

## 2. Rétention du journal d'audit

Le journal d'audit n'est plus tronqué à 500 entrées. Pour éviter une croissance illimitée, une rétention doit être appliquée (ex. 1 an).

### Option A : Appel API (recommandé pour cron)

L'application expose une route admin pour purger le journal (à appeler avec un compte admin, ex. depuis un cron avec un token ou cookie de session) :

```bash
# Exemple (remplacer par votre URL et auth admin)
curl -X POST "https://votre-app/api/audit-logs/prune?retentionDays=365" \
  -H "Cookie: auth_token=..." \
  -H "X-CSRF-Token: ..."
```

Réponse : `{ "deleted": 42, "retentionDays": 365 }`.  
Paramètre optionnel : `retentionDays` (défaut 365, max 3650).

### Option B : Script Node de purge

Créer un script Node qui appelle la purge (ex. `scripts/prune-audit.js`) :

```js
require('dotenv/config');
const { getDb } = require('../server/db');
const { storage } = require('../server/storage');

const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10);
const deleted = storage.pruneAuditLogsOlderThan(retentionDays);
console.log(`Audit: ${deleted} entrée(s) supprimée(s) (rétention ${retentionDays} jours).`);
```

À lancer en cron (ex. une fois par semaine) :  
`0 3 * * 0 cd /chemin/app && node scripts/prune-audit.js`

### Option C : Export avant purge

Pour conserver un historique long terme, vous pouvez exporter le journal (via l'API admin `/api/audit-logs?limit=…` ou un export SQL) vers un fichier ou un stockage externe avant d'exécuter la purge.

#### Export audit par plage de dates

L'application expose une route admin pour exporter le journal d'audit dans un format structuré (CSV ou JSON) :

```bash
# Export CSV
curl -X GET "https://votre-app/api/audit-logs/export?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z&format=csv" \
  -H "Cookie: auth_token=..." \
  -H "X-CSRF-Token: ..." \
  -o audit-export.csv

# Export JSON
curl -X GET "https://votre-app/api/audit-logs/export?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z&format=json" \
  -H "Cookie: auth_token=..." \
  -H "X-CSRF-Token: ..." \
  -o audit-export.json
```

**Format CSV :**
- En-têtes : `date,userId,userName,action,entityType,entityId,details`
- Encodage : UTF-8 avec BOM optionnel
- Échappement : les valeurs contenant des virgules, guillemets ou retours à la ligne sont entre guillemets doubles

**Format JSON :**
```json
{
  "from": "2025-01-01T00:00:00.000Z",
  "to": "2025-12-31T23:59:59.999Z",
  "count": 1234,
  "logs": [
    {
      "id": "audit-...",
      "userId": "user-...",
      "userName": "John Doe",
      "action": "created",
      "entityType": "family",
      "entityId": "fam-...",
      "details": "...",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

**Paramètres :**
- `from` (requis) : date de début au format ISO 8601
- `to` (requis) : date de fin au format ISO 8601
- `format` (optionnel) : `csv` ou `json` (défaut : `json`)

### Variable d'environnement

- **AUDIT_RETENTION_DAYS** (optionnel) : nombre de jours à conserver dans le journal d'audit (défaut recommandé : 365). Utilisé par votre script ou outil de purge.

---

## 3. Restauration

### Restauration de la base SQLite

1. Arrêter l'application (PM2, systemd, etc.).
2. Remplacer la base et les fichiers WAL par une sauvegarde saine :
   ```bash
   cp -a backups/aide-famille-YYYYMMDD.db data/aide-famille.db
   rm -f data/aide-famille.db-wal data/aide-famille.db-shm
   ```
3. Redémarrer l'application.

Les sessions utilisateur (cookies) restent valides tant que le secret `AUTH_SECRET` n'a pas changé. Les mots de passe sont dans la table `passwords` ; en cas de restauration d'une vieille sauvegarde, les comptes seront ceux de cette date.

### Restauration des documents (stockage objet)

En cas de perte du bucket ou d'objets, restaurer depuis vos sauvegardes bucket (snapshots, versioning, réplication) selon la procédure de votre hébergeur. Les enregistrements en base (`family_documents.file_key`) pointent vers ces objets ; si les clés ne changent pas, aucune mise à jour de la base n'est nécessaire après restauration des fichiers.

---

## 4. Métriques et observabilité

### Métriques serveur

L'application expose un endpoint `/api/metrics` (admin uniquement) qui fournit :

**Métriques techniques :**
- `totalRequests` : nombre total de requêtes depuis le démarrage
- `status4xx` : nombre d'erreurs client (4xx)
- `status5xx` : nombre d'erreurs serveur (5xx)
- `latencyMs` : latence (moyenne, p95, dernière)

**Métriques métier** (si l'utilisateur est authentifié avec une organisation) :
- `totalFamilies` : nombre total de familles
- `activeFamilies` : nombre de familles actives (non archivées)
- `totalNeeds` : nombre total de besoins
- `urgentNeeds` : nombre de besoins urgents non couverts
- `totalAids` : nombre total d'aides
- `aidsToday` : nombre d'aides enregistrées aujourd'hui
- `aidsThisWeek` : nombre d'aides enregistrées cette semaine
- `aidsThisMonth` : nombre d'aides enregistrées ce mois
- `totalUsers` : nombre total d'utilisateurs
- `activeUsers` : nombre d'utilisateurs actifs
- `totalInterventions` : nombre total d'interventions
- `interventionsInProgress` : nombre d'interventions en cours

**Exemple d'utilisation :**
```bash
curl -X GET "https://votre-app/api/metrics" \
  -H "Cookie: auth_token=..." \
  -H "X-CSRF-Token: ..."
```

Les métriques techniques sont en mémoire et sont réinitialisées au redémarrage du serveur. Les métriques métier sont calculées en temps réel depuis la base de données et sont filtrées par organisation si l'utilisateur appartient à une organisation.

---

## 5. Résumé des bonnes pratiques

| Élément | Recommandation |
|--------|----------------|
| Base SQLite | Sauvegarde quotidienne avec rotation (ex. 30 jours). |
| Journal d'audit | Purge périodique (ex. 1 an) via script ou cron. Export avant purge pour archivage long terme. |
| Stockage objet | Activer versioning / sauvegardes côté bucket. |
| Métriques | Surveiller régulièrement les métriques serveur et métier via `/api/metrics`. |
| Restauration | Tester régulièrement une restauration sur une copie. |
