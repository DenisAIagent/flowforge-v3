# FlowForge v2.0 - Plateforme d'Automatisation Professionnelle

FlowForge est une plateforme complète de gestion de workflows d'automatisation avec interface chat intelligente, gestion multi-utilisateurs et espace d'intégrations sécurisé.

**Note :** FlowForge est compatible avec les composants open source de Pipedream tout en ajoutant une interface IA conversationnelle, une gestion multi-utilisateurs avancée et un système d'intégrations sécurisé.

## Nouvelles Fonctionnalités v2.0

### Interface Chat Intelligente
- **Conversation naturelle** avec l'IA pour créer des workflows
- **Questions de clarification** automatiques pour optimiser les résultats
- **Génération de workflows** directement depuis le chat
- **Historique des conversations** personnalisé par utilisateur

### Gestion Multi-Utilisateurs
- **Authentification sécurisée** avec sessions JWT
- **Rôles et permissions** (Admin, User, Viewer)
- **Isolation des données** par utilisateur
- **Interface d'administration** complète

### Espace d'Intégrations
- **Configuration centralisée** des services (Claude, Google, Brevo, Discord, Slack, GitHub)
- **Chiffrement AES-256-GCM** des credentials
- **Tests de connexion** automatiques
- **Gestion par catégories** (IA, Productivité, Communication, etc.)

### Interface Utilisateur Moderne
- **Design professionnel** sans éléments fantaisistes
- **Navigation intuitive** avec sidebar
- **Responsive design** pour mobile et desktop
- **Thème cohérent** avec variables CSS

## Architecture Technique

```
flowforge/
├── src/
│   ├── index.js              # API principale avec authentification
│   ├── auth.js               # Gestion utilisateurs et sessions
│   ├── chat.js               # Assistant IA conversationnel
│   ├── integrations.js       # Gestion des services externes
│   ├── component-runner.js   # Exécuteur de workflows
│   ├── scheduler.js          # Planificateur automatique
│   ├── config.js             # Configuration système
│   ├── crypto.js             # Chiffrement sécurisé
│   ├── db/
│   │   ├── schema.sql        # Schéma complet multi-utilisateurs
│   │   └── pool.js           # Connexion PostgreSQL
│   └── utils/
│       ├── logger.js         # Logging structuré
│       └── alert.js          # Système d'alertes
├── public/
│   ├── index.html            # Interface utilisateur moderne
│   └── app.js                # Logique frontend complète
├── package.json              # Dépendances Node.js
├── Dockerfile                # Configuration Docker
├── docker-compose.yml        # Orchestration avec PostgreSQL
└── generate-key.js           # Utilitaire de génération de clés
```

## Installation et Configuration

### Prérequis
- Node.js 18+
- PostgreSQL 12+
- Docker (optionnel)

### Installation Rapide

1. **Extraire et installer**
```bash
tar -xzf flowforge.tar.gz
cd flowforge
npm install
```

2. **Générer une clé de chiffrement**
```bash
node generate-key.js
```

3. **Configurer l'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos configurations
```

4. **Initialiser la base de données**
```bash
createdb flowforge
psql -d flowforge -f src/db/schema.sql
```

5. **Démarrer l'application**
```bash
npm start
```

### Configuration avec Docker

```bash
# Avec docker-compose (recommandé)
docker-compose up -d

# Ou construction manuelle
docker build -t flowforge .
docker run -p 3000:3000 flowforge
```

## Configuration des Variables d'Environnement

```ini
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/flowforge

# Chiffrement (généré avec generate-key.js)
ENCRYPTION_KEY=<32_byte_base64_key>

# API Claude (requis pour le chat IA)
CLAUDE_API_KEY=<your_claude_api_key>

# Alertes Discord (optionnel)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Serveur
PORT=3000
NODE_ENV=production
```

## Utilisation

### 1. Première Connexion
- Accédez à `http://localhost:3000`
- Créez un compte administrateur
- Configurez vos intégrations

### 2. Configuration des Intégrations
Configurez vos services dans l'espace "Intégrations" :

**Claude (IA)**
- Clé API Anthropic pour le chat intelligent

**Google APIs**
- Client ID, Client Secret pour Google Sheets/Gmail

**Brevo (Email)**
- Clé API pour l'envoi d'emails

**Discord/Slack**
- Webhooks ou tokens pour les notifications

**GitHub**
- Personal Access Token pour les issues

### 3. Création de Workflows via Chat
1. Ouvrez l'Assistant IA
2. Décrivez votre besoin : "Je veux envoyer un email quand..."
3. L'IA pose des questions de clarification
4. Le workflow est généré automatiquement

### 4. Gestion des Utilisateurs (Admin)
- Créer/modifier des utilisateurs
- Attribuer des rôles et permissions
- Consulter les statistiques d'utilisation

## API REST Complète

### Authentification
```bash
POST /v1/auth/register    # Inscription
POST /v1/auth/login       # Connexion
GET  /v1/auth/validate    # Validation session
POST /v1/auth/logout      # Déconnexion
```

### Chat IA
```bash
POST /v1/chat/start                    # Nouvelle conversation
GET  /v1/chat/:sessionId/messages      # Historique messages
POST /v1/chat/:sessionId/message       # Envoyer message
GET  /v1/chat/conversations            # Lister conversations
```

### Intégrations
```bash
GET    /v1/integrations           # Lister intégrations
POST   /v1/integrations           # Créer intégration
POST   /v1/integrations/:id/test  # Tester connexion
DELETE /v1/integrations/:id       # Supprimer intégration
```

### Workflows
```bash
GET    /v1/workflows              # Lister workflows
GET    /v1/workflows/:id          # Détails workflow
PATCH  /v1/workflows/:id          # Modifier workflow
DELETE /v1/workflows/:id          # Supprimer workflow
POST   /v1/workflows/create-from-prompt  # Création legacy
```

### Administration
```bash
GET   /v1/admin/users             # Lister utilisateurs
PATCH /v1/admin/users/:id         # Modifier utilisateur
GET   /v1/admin/stats             # Statistiques système
```

## Sécurité

### Chiffrement
- **AES-256-GCM** pour tous les credentials
- **Clés uniques** par installation
- **Hachage PBKDF2** pour les mots de passe

### Authentification
- **Sessions JWT** sécurisées
- **Expiration automatique** des sessions
- **Nettoyage périodique** des sessions expirées

### Autorisation
- **Isolation par utilisateur** des données
- **Contrôle d'accès** granulaire
- **Validation stricte** des permissions

## Services Supportés

| Service | Type | Fonctionnalités |
|---------|------|----------------|
| **Claude** | IA | Chat conversationnel, génération de workflows |
| **Google** | Productivité | Sheets, Gmail, Drive |
| **Brevo** | Email | Envoi d'emails, campagnes |
| **Discord** | Communication | Messages, webhooks |
| **Slack** | Communication | Messages, notifications |
| **GitHub** | Développement | Issues, repositories |

## Monitoring et Logs

### Logs Structurés
- **Format JSON** avec Pino
- **Niveaux configurables** (debug, info, warn, error)
- **Contexte enrichi** (user_id, workflow_id, etc.)

### Métriques
- **Exécutions par utilisateur**
- **Taux de succès/échec**
- **Performance des intégrations**
- **Utilisation du chat IA**

### Alertes
- **Notifications Discord** en cas d'échec
- **Logs d'erreur** détaillés
- **Monitoring de santé** des services

## Déploiement en Production

### Recommandations
- **PostgreSQL** avec réplication
- **Reverse proxy** (Nginx/Traefik)
- **SSL/TLS** obligatoire
- **Sauvegarde** régulière de la base

### Variables d'Environnement Production
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<secure_key>
CLAUDE_API_KEY=<production_key>
```

### Monitoring
- **Health checks** sur `/health`
- **Logs centralisés** (ELK, Grafana)
- **Métriques** d'utilisation
- **Alertes** proactives

## Développement

### Structure du Code
- **Modules ES6** avec imports/exports
- **Séparation des responsabilités** claire
- **Gestion d'erreurs** robuste
- **Tests unitaires** (à implémenter)

### Contribution
1. Fork du projet
2. Branche feature
3. Tests et documentation
4. Pull Request

## Support et Documentation

### Ressources
- **API Documentation** : `/health` pour le statut
- **Logs** : Consultables via l'interface admin
- **GitHub Issues** : Pour les bugs et demandes

### Dépannage
- **Vérifier** les logs d'application
- **Tester** les connexions d'intégration
- **Valider** la configuration de base de données

## Roadmap v2.1

### Fonctionnalités Prévues
- **Workflows visuels** avec éditeur drag & drop
- **Triggers avancés** (webhooks, emails, fichiers)
- **Intégrations supplémentaires** (Notion, Airtable, Zapier)
- **API publique** pour développeurs tiers
- **Marketplace** de workflows communautaires

### Améliorations Techniques
- **Tests automatisés** complets
- **Performance** optimisée
- **Scalabilité** horizontale
- **Monitoring** avancé

---

**FlowForge v2.0** - Automatisation professionnelle sans compromis

Développé avec une approche centrée sur la sécurité, la performance et l'expérience utilisateur.

