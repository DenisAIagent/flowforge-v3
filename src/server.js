import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

async function startServer() {
  try {
    logger.info('🚀 Démarrage du serveur FlowForge v2.1');
    
    // Créer l'application
    const app = await createApp();
    
    // Configuration d'écoute
    const host = process.env.RAILWAY_STATIC_URL ? '0.0.0.0' : 'localhost';
    const port = config.port;
    
    logger.info(`🌐 Tentative de démarrage sur ${host}:${port}`);
    
    // Démarrer le serveur
    await app.listen({ 
      port: port, 
      host: host 
    });
    
    logger.info({
      port: port,
      host: host,
      environment: config.nodeEnv,
      isRailway: config.isRailway
    }, `🎉 FlowForge v2.1 démarré avec succès !`);
    
    if (config.isRailway) {
      logger.info('🚂 Application déployée sur Railway');
      logger.info(`🔗 Health check: /health`);
    }
    
    // Charger le scheduler (optionnel)
    try {
      await import('./scheduler.js');
      logger.info('✅ Scheduler chargé');
    } catch (error) {
      logger.warn('⚠️ Scheduler non disponible:', error.message);
    }
    
  } catch (error) {
    logger.error({ error }, '❌ Erreur critique de démarrage');
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

// Gestion des signaux de fermeture propre
process.on('SIGTERM', () => {
  logger.info('📡 Signal SIGTERM reçu, arrêt en cours...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('📡 Signal SIGINT reçu, arrêt en cours...');
  process.exit(0);
});

// Démarrer le serveur
startServer();