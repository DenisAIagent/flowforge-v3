import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Vérification DATABASE_URL en production (warning seulement)
if (config.isProduction && !config.databaseUrl) {
  console.error('❌ ATTENTION: DATABASE_URL manquante en production');
  console.error('Vérifiez la variable d\'environnement DATABASE_URL sur Railway');
  console.error('⚠️  Application va continuer mais les fonctionnalités DB seront indisponibles');
}

console.log('🗄️ Configuration DB:', {
  url: config.databaseUrl ? config.databaseUrl.substring(0, 20) + '...' : 'MANQUANTE',
  ssl: config.isProduction,
  production: config.isProduction
});

// Configuration de la pool avec gestion d'erreurs
let pool;

if (config.databaseUrl) {
  console.log('🗄️ Configuration DB:', {
    url: config.databaseUrl ? config.databaseUrl.substring(0, 20) + '...' : 'MANQUANTE',
    ssl: config.isProduction,
    production: config.isProduction
  });

  // Configuration pool standard (plus stable)
  const poolConfig = {
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: config.isProduction ? { rejectUnauthorized: false } : false
  };

  pool = new Pool(poolConfig);
} else {
  // Pool mock si pas de DATABASE_URL
  console.warn('⚠️  Utilisation d\'une pool mock - DB indisponible');
  pool = {
    query: () => Promise.reject(new Error('DATABASE_URL non configurée')),
    end: () => Promise.resolve(),
    on: () => {}
  };
}

// Gestion des erreurs de connexion
pool.on('error', (err) => {
  console.error('❌ Erreur inattendue sur le pool de base de données:', err);
});

pool.on('connect', () => {
  console.log('✅ Nouvelle connexion établie avec PostgreSQL');
});

// Test de connexion au démarrage (asynchrone et non-bloquant)
if (config.databaseUrl && pool.query) {
  setTimeout(() => {
    pool.query('SELECT NOW()')
      .then(() => {
        console.log('✅ Connexion PostgreSQL testée avec succès');
      })
      .catch(error => {
        console.error('❌ Erreur de connexion PostgreSQL:', error.message);
        console.error('⚠️  Application va continuer mais les fonctionnalités DB seront indisponibles');
      });
  }, 1000); // Délai de 1s pour ne pas bloquer le démarrage
} else {
  console.warn('⚠️  Test de connexion DB ignoré');
}

export default pool;

