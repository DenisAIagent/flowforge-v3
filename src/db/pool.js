import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Vérification DATABASE_URL obligatoire en production
if (config.isProduction && !config.databaseUrl) {
  console.error('❌ ERREUR CRITIQUE: DATABASE_URL manquante en production');
  console.error('Vérifiez la variable d\'environnement DATABASE_URL sur Railway');
  process.exit(1);
}

console.log('🗄️ Configuration DB:', {
  url: config.databaseUrl ? config.databaseUrl.substring(0, 20) + '...' : 'MANQUANTE',
  ssl: config.isProduction,
  production: config.isProduction
});

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
  console.error('❌ Erreur inattendue sur le pool de base de données:', err);
});

pool.on('connect', () => {
  console.log('✅ Nouvelle connexion établie avec PostgreSQL');
});

// Test de connexion au démarrage (asynchrone)
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ Connexion PostgreSQL testée avec succès');
  })
  .catch(error => {
    console.error('❌ Erreur de connexion PostgreSQL:', error.message);
    if (config.isProduction) {
      console.error('⚠️  Application va continuer mais les fonctionnalités DB seront indisponibles');
    }
  });

export default pool;

