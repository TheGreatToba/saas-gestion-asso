# Tutoriel : Lancer le SaaS sur un VPS (sans nom de domaine)

Ce guide explique comment déployer **Aide Famille Hub** sur un serveur VPS (Ubuntu/Debian) en accédant à l’app via **l’IP du serveur** (sans nom de domaine ni HTTPS). On utilise Node.js et PM2. Nginx et HTTPS sont optionnels et décrits à la fin pour quand tu auras un domaine.

---

## Prérequis

- Un VPS avec **Ubuntu 22.04** (ou Debian 12) et un accès SSH
- L’**IP publique** de ton VPS (tu la trouves dans le panel de ton hébergeur)
- Un terminal pour te connecter en SSH

---

## 1. Connexion au VPS

Remplace `IP_DE_TON_VPS` par l’IP réelle de ton serveur.

```bash
ssh root@IP_DE_TON_VPS
# ou avec un utilisateur : ssh utilisateur@IP_DE_TON_VPS
```

---

## 2. Préparer le système

### Mettre à jour le système

```bash
sudo apt update && sudo apt upgrade -y
```

### Installer Node.js 20 (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # doit afficher v20.x
```

### Installer pnpm

```bash
sudo npm install -g pnpm
pnpm -v
```

### Installer Git (si pas déjà fait)

```bash
sudo apt install -y git
```

---

## 3. Cloner le projet et installer les dépendances

Crée un répertoire pour l’application (par ex. sous un utilisateur dédié) :

```bash
# Option : créer un utilisateur dédié (recommandé)
sudo adduser --disabled-password --gecos "" appuser
sudo su - appuser

# Cloner le dépôt (remplace par ton repo Git)
git clone https://github.com/TON_ORG/TON_REPO.git aide-famille-hub
cd aide-famille-hub
```

Si tu déploies depuis ta machine (sans Git sur le VPS), tu peux utiliser `rsync` ou `scp` pour copier le dossier du projet.

Installer les dépendances et construire l’app :

```bash
pnpm install --frozen-lockfile
pnpm build
```

Vérifier que le build a créé les bons dossiers :

```bash
ls dist/server/   # doit contenir node-build.mjs
ls dist/spa/      # doit contenir index.html et les assets
```

---

## 4. Variables d’environnement

En production, le serveur **refuse de démarrer** sans `AUTH_SECRET`. Il faut aussi configurer CORS avec l’URL d’accès (ici l’IP du VPS).

Crée ou édite le fichier `.env` à la racine du projet :

```bash
nano .env
```

Contenu minimal pour la production **sans nom de domaine** (remplace `IP_DE_TON_VPS` par l’IP réelle, ex. `51.83.42.100`) :

```env
# Obligatoire en production
NODE_ENV=production
AUTH_SECRET=GENERER_UN_SECRET_LONG_ET_ALEATOIRE_ICI

# CORS : l’URL d’accès = http://IP:3000 (sans domaine on utilise l’IP)
# ⚠️ OBLIGATOIRE : utilise EXACTEMENT l’URL avec laquelle tu ouvres le site.
#    Si CORS_ORIGINS ne contient pas cette URL, tu auras un écran blanc (500 sur /assets/*).
CORS_ORIGINS=http://IP_DE_TON_VPS:3000

# Port sur lequel écoute l’app (défaut 3000)
PORT=3000
```

Pour générer un secret fort :

```bash
openssl rand -base64 32
```

Colle le résultat dans `AUTH_SECRET=...`.

Si tu utilises le stockage objet (S3/MinIO) pour les documents, ajoute aussi dans `.env` :

```env
OBJECT_STORAGE_BUCKET=ton-bucket
OBJECT_STORAGE_REGION=eu-west-1
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_FORCE_PATH_STYLE=true
```

Sauvegarde : `Ctrl+O`, Entrée, puis `Ctrl+X`.

**Sécurité :** ne committe jamais `.env`. Vérifie qu’il est bien dans `.gitignore`.

---

## 5. Lancer l’app avec PM2

PM2 garde l’app en marche et la relance en cas de crash.

### Installer PM2

```bash
sudo npm install -g pm2
```

### Démarrer l’application

Depuis la racine du projet (`aide-famille-hub`) :

```bash
pm2 start dist/server/node-build.mjs --name "aide-famille-hub"
```

PM2 charge automatiquement un fichier `.env` s’il est dans le répertoire courant. Sinon, tu peux préciser le fichier :

```bash
pm2 start dist/server/node-build.mjs --name "aide-famille-hub" --env production
```

Ou avec un fichier d’écosystème (recommandé) :

```bash
nano ecosystem.config.cjs
```

Contenu :

```javascript
module.exports = {
  apps: [
    {
      name: "aide-famille-hub",
      script: "dist/server/node-build.mjs",
      cwd: "/home/appuser/aide-famille-hub", // adapte le chemin
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      env_file: ".env",
    },
  ],
};
```

Puis :

```bash
pm2 start ecosystem.config.cjs
```

### Commandes utiles PM2

```bash
pm2 status              # état des processus
pm2 logs aide-famille-hub   # logs en direct
pm2 restart aide-famille-hub
pm2 stop aide-famille-hub
```

### Démarrage automatique au boot

```bash
pm2 startup
# exécute la commande que PM2 affiche (souvent un sudo env PATH=...)
pm2 save
```

L’app écoute maintenant sur le port **3000**. Tu peux y accéder directement depuis ton navigateur : **`http://IP_DE_TON_VPS:3000`** (remplace par l’IP réelle).

**Important :** assure-toi que le port 3000 est ouvert dans le pare-feu du VPS (voir [Ouvrir le port 3000](#ouvrir-le-port-3000-pare-feu) ci-dessous).

---

## 6. Ouvrir le port 3000 (pare-feu)

Pour que l’app soit accessible depuis Internet, le port 3000 doit être autorisé.

**Si tu utilises `ufw` :**

```bash
sudo ufw allow 3000/tcp
sudo ufw status
sudo ufw enable   # si pas déjà activé
```

**Si ton hébergeur a un pare-feu dans le panel** (ex. OVH, Scaleway, etc.), ajoute une règle pour le port **TCP 3000**.

---

## 7. Vérifications

1. **Health check** (depuis le VPS ou ta machine) :
   ```bash
   curl http://IP_DE_TON_VPS:3000/health
   ```
   Réponse attendue : `{"status":"ok"}`

2. **Page d’accueil**  
   Ouvre **`http://IP_DE_TON_VPS:3000`** dans ton navigateur : tu dois voir l’interface de l’app (écran de connexion).

3. **Logs**  
   En cas d’erreur : `pm2 logs aide-famille-hub`

---

## 8. Mise à jour du déploiement

À chaque nouveau déploiement :

```bash
cd /home/appuser/aide-famille-hub   # ou ton chemin
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart aide-famille-hub
```

Si tu as changé des variables d’environnement dans `.env`, un simple `pm2 restart aide-famille-hub` suffit après édition du `.env`.

---

## 9. Résumé des variables d’environnement (sans domaine)

| Variable           | Obligatoire (prod) | Description                                      |
|--------------------|--------------------|--------------------------------------------------|
| `NODE_ENV`         | Oui                | `production`                                     |
| `AUTH_SECRET`      | Oui                | Secret pour signer les tokens (génère avec `openssl rand -base64 32`) |
| `CORS_ORIGINS`     | Oui                | URL d’accès : `http://IP_DU_VPS:3000` (sans domaine) |
| `PORT`             | Non                | Port d’écoute (défaut 3000)                      |
| `OBJECT_STORAGE_*` | Si tu utilises S3  | Bucket, région, endpoint, etc.                   |

---

## Dépannage

- **Écran blanc + erreurs 500 sur `/assets/*` dans la console** : en production, le serveur rejette les requêtes dont l’origine n’est pas autorisée. Ajoute dans `.env` l’URL exacte d’accès au site : `CORS_ORIGINS=http://46.202.173.225:3000` (remplace par ton IP si besoin), puis redémarre l’app (`pm2 restart aide-famille-hub`).
- **Page inaccessible / timeout** : le port 3000 n’est peut-être pas ouvert. Vérifie le pare-feu (section 6) et les règles dans le panel de ton hébergeur.
- **CORS / requêtes bloquées** : `CORS_ORIGINS` doit être **exactement** l’URL que tu tapes dans le navigateur (ex. `http://51.83.42.100:3000`), sans slash final.
- **Session invalide / 401** : vérifie que `AUTH_SECRET` n’a pas été modifié entre deux redémarrages.
- **Fichiers / uploads** : si tu utilises le stockage objet, vérifie les variables `OBJECT_STORAGE_*` et les droits sur le bucket.

---

## (Optionnel) Plus tard : nom de domaine, Nginx et HTTPS

Quand tu auras un **nom de domaine** pointant vers l’IP du VPS :

1. **Nginx** : installe Nginx et crée un virtual host avec `server_name ton-domaine.org`, en `proxy_pass http://127.0.0.1:3000`. Tu pourras alors utiliser le port 80 et mettre dans `.env` : `CORS_ORIGINS=https://ton-domaine.org`.
2. **HTTPS** : installe Certbot (`certbot --nginx -d ton-domaine.org`) pour obtenir un certificat Let’s Encrypt gratuit. L’app sera alors en `https://ton-domaine.org`.

Sans domaine, l’app en **HTTP sur le port 3000** est suffisante pour tester et un usage interne.

---

Tu as maintenant le SaaS qui tourne sur ton VPS en **http://IP:3000**, avec redémarrage automatique via PM2.
