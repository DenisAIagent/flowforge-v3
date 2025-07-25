# 🚀 Configuration Railway pour FlowForge

Guide complet pour déployer FlowForge sur Railway avec authentification complète.

## 📋 Variables d'environnement requises

### Variables OBLIGATOIRES
```bash
DATABASE_URL=postgresql://...  # PostgreSQL addon Railway
ENCRYPTION_KEY=your-32-char-encryption-key
SESSION_SECRET=your-session-secret-key
```

### Variables RECOMMANDÉES
```bash
# Google OAuth (optionnel)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email SMTP (optionnel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@flowforge.com
ADMIN_EMAIL=admin@yourcompany.com

# Claude API (optionnel)
CLAUDE_API_KEY=your-claude-api-key
```

## 🔧 Étapes de déploiement

### 1. Créer le projet Railway
```bash
railway login
railway init
railway add postgresql
```

### 2. Configurer les variables d'environnement
Dans le dashboard Railway, ajouter toutes les variables ci-dessus.

### 3. Déployer le code
```bash
git push railway main
```

### 4. Initialiser la base de données
Le script `postbuild` s'exécute automatiquement et :
- ✅ Initialise le schema de base de données
- ✅ Applique les migrations email
- ✅ Crée le compte SuperAdmin

### 5. Vérifier le déploiement
- Accéder à votre URL Railway
- Vérifier `/health` pour le statut
- Tester la connexion SuperAdmin

## 🔐 Identifiants SuperAdmin

**Email:** `admin@flowforge.com`  
**Mot de passe:** `FlowForge2025!Admin`

## 🛠️ Commandes utiles

```bash
# Setup complet (déjà automatique)
npm run railway:setup

# Initialiser seulement la DB
npm run db:init

# Appliquer migrations email
npm run db:migrate-email

# Créer/mettre à jour SuperAdmin
npm run db:create-superadmin
```

## 🐛 Dépannage

### Erreur "authService not defined"
- Vérifier que toutes les dépendances sont installées
- Relancer le déploiement

### Erreur 400 sur registration
- Vérifier que `DATABASE_URL` est configuré
- Vérifier les logs Railway pour plus de détails
- S'assurer que la DB est initialisée

### Erreur Google OAuth
- Configurer `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`
- Ajouter l'URL Railway dans Google Console

### Problèmes email
- Configurer toutes les variables `SMTP_*`
- Utiliser un mot de passe d'application Gmail

## 📊 Fonctionnalités

✅ **Authentification dual**
- Google OAuth avec approbation admin
- Email/mot de passe avec vérification

✅ **Sécurité enterprise**
- Passwords hashés avec bcrypt
- Sessions sécurisées
- Tokens UUID pour vérification

✅ **Interface moderne**
- Design responsive
- Onglets dynamiques
- Messages d'erreur clairs

✅ **Administration**
- SuperAdmin prédéfini
- Gestion des utilisateurs
- Dashboard complet

## 🌐 URLs importantes

- **App:** `https://your-app.up.railway.app`
- **Health:** `https://your-app.up.railway.app/health`
- **Admin:** Connexion avec identifiants SuperAdmin

---

🎉 **FlowForge est maintenant prêt sur Railway !**