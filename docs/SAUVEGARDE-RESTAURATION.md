# Sauvegarde, restauration et rétention des données

Ce document décrit les procédures de sauvegarde de la base de données, la politique de rétention du journal d’audit et la restauration en cas d’incident.

---

## 1. Sauvegarde de la base de données

La base SQLite est stockée dans le répertoire `data/` à la racine du projet (ou du déploiement) :

- **Fichier principal :** `data/aide-famille.db`
- **Fichiers WAL (si mode WAL actif) :** `data/aide-famille.db-wal`, `data/aide-famille.db-shm`

### Sauvegarde manuelle

```bash
# Depuis la racine du projet / de l’application
mkdir -p backups
cp -a data/aide-famille.db* backups/
# Optionnel : nommer avec la date
cp -a data/aide-famille.db "backups/aide-famille-$(date +%Y%m%d-%H%M).db"
```

Pour un backup cohérent, il est préférable d’arrêter brièvement l’application ou d’utiliser la sauvegarde en ligne de SQLite (`sqlite3 .backup backups/backup.db`).

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

Si l’application utilise un stockage objet (S3 / MinIO) pour les documents (voir `OBJECT_STORAGE_*`), les sauvegardes doivent être gérées côté bucket (versioning, politique de rétention, sauvegarde cross-région selon votre hébergeur).

---

## 2. Rétention du journal d’audit

Le journal d’audit n’est plus tronqué à 500 entrées. Pour éviter une croissance illimitée, une rétention doit être appliquée (ex. 1 an).

### Option A : Appel API (recommandé pour cron)

L’application expose une route admin pour purger le journal (à appeler avec un compte admin, ex. depuis un cron avec un token ou cookie de session) :

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

Pour conserver un historique long terme, vous pouvez exporter le journal (via l’API admin `/api/audit-logs?limit=…` ou un export SQL) vers un fichier ou un stockage externe avant d’exécuter la purge.

### Variable d’environnement

- **AUDIT_RETENTION_DAYS** (optionnel) : nombre de jours à conserver dans le journal d’audit (défaut recommandé : 365). Utilisé par votre script ou outil de purge.

---

## 3. Restauration

### Restauration de la base SQLite

1. Arrêter l’application (PM2, systemd, etc.).
2. Remplacer la base et les fichiers WAL par une sauvegarde saine :
   ```bash
   cp -a backups/aide-famille-YYYYMMDD.db data/aide-famille.db
   rm -f data/aide-famille.db-wal data/aide-famille.db-shm
   ```
3. Redémarrer l’application.

Les sessions utilisateur (cookies) restent valides tant que le secret `AUTH_SECRET` n’a pas changé. Les mots de passe sont dans la table `passwords` ; en cas de restauration d’une vieille sauvegarde, les comptes seront ceux de cette date.

### Restauration des documents (stockage objet)

En cas de perte du bucket ou d’objets, restaurer depuis vos sauvegardes bucket (snapshots, versioning, réplication) selon la procédure de votre hébergeur. Les enregistrements en base (`family_documents.file_key`) pointent vers ces objets ; si les clés ne changent pas, aucune mise à jour de la base n’est nécessaire après restauration des fichiers.

---

## 4. Résumé des bonnes pratiques

| Élément | Recommandation |
|--------|----------------|
| Base SQLite | Sauvegarde quotidienne avec rotation (ex. 30 jours). |
| Journal d’audit | Purge périodique (ex. 1 an) via script ou cron. |
| Stockage objet | Activer versioning / sauvegardes côté bucket. |
| Restauration | Tester régulièrement une restauration sur une copie. |
