import dotenv from 'dotenv';
dotenv.config();

// Fonction pour valider les variables d'environnement requises
function validateRequiredEnvVars() {
  const required = [
    'DATABASE_URL',
    'ENCRYPTION_KEY', 
    'CLAUDE_API_KEY'
  ];
  
  const recommended = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'ADMIN_EMAIL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  const missingRecommended = recommended.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`[Config Error] Missing REQUIRED environment variables: ${missing.join(', ')}`);
    console.error('Application cannot function without these variables.');
  }
  
  if (missingRecommended.length > 0) {
    console.warn(`[Config Warning] Missing RECOMMENDED environment variables: ${missingRecommended.join(', ')}`);
    console.warn('Authentication and email features may not work properly.');
  }
}

// Valider au démarrage
validateRequiredEnvVars();

export const config = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/flowforge',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-key-not-for-production',
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  claudeApiKey: process.env.CLAUDE_API_KEY || 'missing-claude-key',
  baseUrl: process.env.BASE_URL || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : 'http://localhost:3000'),
  isProduction: process.env.NODE_ENV === 'production',
  isRailway: !!process.env.RAILWAY_STATIC_URL,
  
  // Configuration Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  },
  
  // Configuration Email
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER
  },
  
  // Configuration Admin
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@flowforge.com'
  },
  
  // Sécurité
  session: {
    secret: process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'dev-session-secret',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
  }
};

