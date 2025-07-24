import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// Configuration de la pool avec gestion d'erreurs
const poolConfig = {
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: config.isProduction ? { rejectUnauthorized: false } : false
};

const pool = new Pool(poolConfig);

// Gestion des erreurs de connexion
pool.on('error', (err) => {
  logger.error({ error: err }, 'Erreur inattendue sur le pool de base de données');
});

pool.on('connect', () => {
  logger.info('Nouvelle connexion établie avec PostgreSQL');
});

// Test de connexion au démarrage (asynchrone)
pool.query('SELECT NOW()')
  .then(() => {
    logger.info('✅ Connexion PostgreSQL testée avec succès');
  })
  .catch(error => {
    logger.error({ error }, '❌ Erreur de connexion PostgreSQL');
    if (config.isProduction) {
      logger.error('Application va s\'arrêter car impossible de se connecter à la base de données');
    }
  });

export default pool;

