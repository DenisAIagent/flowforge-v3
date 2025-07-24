import dotenv from 'dotenv';
dotenv.config();

// Fonction pour valider les variables d'environnement requises
function validateRequiredEnvVars() {
  const required = [
    'DATABASE_URL',
    'ENCRYPTION_KEY', 
    'CLAUDE_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`[Config Warning] Missing environment variables: ${missing.join(', ')}`);
    console.warn('Application may not function properly without these variables.');
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
  isRailway: !!process.env.RAILWAY_STATIC_URL
};

