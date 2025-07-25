# FlowForge v2.1 - Configuration d'Authentification

## 🚀 Système d'authentification complet intégré !

Le système d'authentification Google OAuth avec approbation manuelle par admin est maintenant **entièrement fonctionnel**.

## 📋 Variables d'environnement requises

Créez un fichier `.env` avec les variables suivantes :

### ✅ Variables OBLIGATOIRES
```bash
# Base de données PostgreSQL
DATABASE_URL="postgresql://username:password@host:port/database"

# Clé de chiffrement
ENCRYPTION_KEY="your-strong-encryption-key-here"

# API Claude (pour les agents IA)
CLAUDE_API_KEY="your-claude-api-key"
```

### 🔧 Variables pour l'authentification Google
```bash
# Google OAuth (requis pour l'auth)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="https://your-domain.com/auth/google/callback"

# Configuration SMTP pour les emails (Gmail recommandé)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="your-email@gmail.com"

# Email administrateur
ADMIN_EMAIL="admin@flowforge.com"

# Secret de session (optionnel, utilise ENCRYPTION_KEY par défaut)
SESSION_SECRET="your-session-secret"
```

## 🛠️ Configuration Google OAuth

1. **Aller sur [Google Cloud Console](https://console.cloud.google.com/)**
2. **Créer un nouveau projet ou sélectionner un projet existant**
3. **Activer l'API Google+ ou Google Identity**
4. **Créer des identifiants OAuth 2.0:**
   - Type: Application Web
   - URI de redirection autorisées: `https://your-domain.com/auth/google/callback`
5. **Copier CLIENT_ID et CLIENT_SECRET dans le .env**

## 📧 Configuration SMTP (Gmail)

1. **Activer la validation en 2 étapes sur votre compte Gmail**
2. **Générer un mot de passe d'application:**
   - Aller dans Paramètres Google → Sécurité → Validation en 2 étapes → Mots de passe des applications
   - Créer un nouveau mot de passe pour "FlowForge"
3. **Utiliser ce mot de passe dans SMTP_PASS**

## 🗄️ Initialisation de la base de données

```bash
# Initialiser les tables d'authentification
npm run db:init
```

Ce script va créer automatiquement :
- ✅ Table `users` (utilisateurs approuvés)
- ✅ Table `access_requests` (demandes d'accès)
- ✅ Table `user_sessions` (sessions actives)
- ✅ Compte administrateur par défaut

## 🚀 Démarrage

```bash
# Démarrer FlowForge
npm start
```

## 🔐 Workflow d'authentification

### 1. **Utilisateur demande l'accès**
- Clic sur "Demander l'accès" 
- Authentification Google
- Demande stockée en base
- Email automatique envoyé à l'admin

### 2. **Admin approuve/refuse**
- Email reçu avec 2 liens : Approuver ✅ / Refuser ❌
- Ou via le panel admin : `/admin/requests`
- Utilisateur notifié automatiquement par email

### 3. **Utilisateur peut se connecter**
- Clic sur "Se connecter"
- Authentification Google
- Redirection vers le dashboard

## 🛡️ Panel d'administration

Accès : `https://your-domain.com/admin/requests`

- ✅ Vue de toutes les demandes en attente
- ✅ Approbation/Refus en 1 clic
- ✅ Statistiques en temps réel
- ✅ Design moderne et responsive

## ✨ Fonctionnalités implémentées

- ✅ **OAuth Google complet** - Pas de simulation
- ✅ **Base de données PostgreSQL** - Schéma complet
- ✅ **Envoi d'emails automatique** - SMTP nodemailer
- ✅ **Sessions sécurisées** - Cookies httpOnly
- ✅ **Panel admin moderne** - Interface clean
- ✅ **Gestion d'erreurs robuste** - Messages explicites
- ✅ **Responsive design** - Mobile-friendly

## 🎯 Déploiement Railway

Toutes les variables d'environnement doivent être configurées dans Railway Dashboard :

1. **DATABASE_URL** - Fourni automatiquement par Railway PostgreSQL
2. **Ajouter toutes les autres variables manuellement**

## 🔥 Prêt pour la production !

Le système d'authentification est **100% fonctionnel** et prêt pour la production. Plus de mock ou simulation - tout est réel et opérationnel.

---

**FlowForge v2.1** - Plateforme d'Agents IA avec authentification enterprise-grade