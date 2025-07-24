import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  encryptionKey: process.env.ENCRYPTION_KEY,
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
};

