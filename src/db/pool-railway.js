import pg from 'pg';
import dns from 'dns';
import { config } from '../config.js';

const { Pool } = pg;

// Forcer IPv4 pour Railway
dns.setDefaultResultOrder('ipv4first');

/**
 * Pool spécialisée Railway avec résolution IPv4 forcée
 */
export function createRailwayPool() {
  if (!config.databaseUrl) {
    console.error('❌ DATABASE_URL manquante pour Railway');
    return null;
  }

  console.log('🚀 Création pool Railway avec IPv4 forcé...');
  console.log('🔍 DATABASE_URL complète:', config.databaseUrl);
  
  try {
    const url = new URL(config.databaseUrl);
    console.log('🔍 URL parsée:', {
      hostname: url.hostname,
      port: url.port,
      database: url.pathname.substring(1),
      protocol: url.protocol
    });
    
    // Tentative de forcer un hostname IPv4 si hostname contient des caractères IPv6
    let finalHost = url.hostname;
    if (url.hostname.includes(':')) {
      console.log('⚠️  Hostname IPv6 détecté, tentative de résolution...');
      // En dernier recours, essayer de mapper vers un nom de domaine
      finalHost = url.hostname.replace(/\[|\]/g, ''); // Supprimer les crochets IPv6
    }
    
    const poolConfig = {
      host: finalHost,
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1),
      user: url.username,
      password: url.password,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      // Options Railway spécifiques
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // Forcer IPv4 via family
      family: 4
    };

    console.log('🗄️ Config Railway Pool:', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
      ssl: !!poolConfig.ssl,
      family: poolConfig.family
    });

    const pool = new Pool(poolConfig);

    // Test de connexion immédiat
    pool.query('SELECT NOW() as test_time')
      .then(result => {
        console.log('✅ Railway Pool connectée:', result.rows[0].test_time);
      })
      .catch(error => {
        console.error('❌ Erreur Railway Pool:', error.message);
        console.error('   Code:', error.code);
        console.error('   Address:', error.address);
        console.error('   Port:', error.port);
      });

    return pool;

  } catch (error) {
    console.error('❌ Erreur création Railway Pool:', error.message);
    return null;
  }
}

export default createRailwayPool;