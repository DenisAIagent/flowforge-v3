# Guide de Déploiement Railway - FlowForge

## Configuration Railway

### 1. Variables d'Environnement Requises

Dans Railway, configurez ces variables d'environnement :

```bash
# Base de données (Railway PostgreSQL)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Chiffrement (générer avec node generate-key.js)
ENCRYPTION_KEY=<votre_clé_32_bytes_base64>

# API Claude (requis pour le chat IA)
CLAUDE_API_KEY=<votre_clé_claude>

# Alertes Discord (optionnel)
DISCORD_WEBHOOK_URL=<votre_webhook_discord>

# Configuration serveur
PORT=${{PORT}}
NODE_ENV=production
```

### 2. Services Railway Nécessaires

1. **PostgreSQL Database**
   - Ajouter le service PostgreSQL depuis Railway
   - La variable `DATABASE_URL` sera automatiquement configurée

2. **Application Node.js**
   - Connecter ce repository GitHub
   - Railway détectera automatiquement le `package.json`

### 3. Étapes de Déploiement

1. **Créer un nouveau projet Railway**
   ```bash
   railway login
   railway init
   ```

2. **Ajouter PostgreSQL**
   - Dans le dashboard Railway : Add Service → Database → PostgreSQL

3. **Configurer les variables d'environnement**
   - Aller dans Settings → Variables
   - Ajouter toutes les variables listées ci-dessus

4. **Générer la clé de chiffrement**
   ```bash
   # Localement
   node generate-key.js
   # Copier la clé générée dans ENCRYPTION_KEY
   ```

5. **Déployer**
   - Railway déploiera automatiquement à chaque push sur main
   - Ou manuellement : `railway up`

### 4. Initialisation de la Base de Données

Après le premier déploiement, exécuter le schéma SQL :

```bash
# Via Railway CLI
railway connect postgres
\i src/db/schema.sql
\q
```

Ou via l'interface Railway :
- Aller dans PostgreSQL → Query
- Copier/coller le contenu de `src/db/schema.sql`

### 5. Configuration Post-Déploiement

1. **Créer le premier utilisateur admin**
   - Aller sur votre URL Railway
   - S'inscrire avec votre email
   - Modifier le rôle en 'admin' directement en base

2. **Configurer les intégrations**
   - Claude API pour le chat IA
   - Services externes selon vos besoins

### 6. Monitoring

Railway fournit automatiquement :
- **Logs** : Consultables dans le dashboard
- **Métriques** : CPU, RAM, réseau
- **Health checks** : Sur `/health`

### 7. Domaine Personnalisé (Optionnel)

1. Dans Railway → Settings → Domains
2. Ajouter votre domaine personnalisé
3. Configurer les DNS selon les instructions

### 8. Sauvegarde

Railway sauvegarde automatiquement PostgreSQL, mais pour plus de sécurité :

```bash
# Sauvegarde manuelle
railway connect postgres
pg_dump $DATABASE_URL > backup.sql
```

## Variables d'Environnement Détaillées

### DATABASE_URL
Fournie automatiquement par Railway PostgreSQL
Format : `postgresql://user:password@host:port/database`

### ENCRYPTION_KEY
Clé de 32 bytes en base64 pour chiffrer les credentials
Générer avec : `node generate-key.js`

### CLAUDE_API_KEY
Clé API Anthropic pour le chat IA
Obtenir sur : https://console.anthropic.com/

### DISCORD_WEBHOOK_URL (Optionnel)
URL webhook Discord pour les alertes d'échec
Format : `https://discord.com/api/webhooks/...`

## Commandes Utiles

```bash
# Voir les logs en temps réel
railway logs

# Ouvrir une console sur le serveur
railway shell

# Connecter à la base de données
railway connect postgres

# Redéployer manuellement
railway up

# Voir le statut
railway status
```

## Dépannage

### Erreur de connexion base de données
- Vérifier que PostgreSQL est bien ajouté au projet
- Vérifier la variable `DATABASE_URL`

### Erreur de démarrage
- Vérifier les logs : `railway logs`
- Vérifier que toutes les variables d'environnement sont configurées

### Chat IA ne fonctionne pas
- Vérifier la variable `CLAUDE_API_KEY`
- Vérifier les quotas API Anthropic

### Problème de permissions
- Vérifier que le premier utilisateur a le rôle 'admin'
- Vérifier les permissions en base de données

## Support

- **Railway Docs** : https://docs.railway.app/
- **FlowForge Issues** : GitHub Issues de ce repository
- **Logs** : Toujours consulter les logs Railway en cas de problème

---

**FlowForge sur Railway** - Déploiement professionnel en quelques minutes

