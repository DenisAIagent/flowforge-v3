import pg from 'pg';
import dns from 'dns';
import { promisify } from 'util';
import { config } from '../config.js';

const { Pool } = pg;

// Forcer IPv4 pour Railway
dns.setDefaultResultOrder('ipv4first');

// Promisify dns.lookup pour résolution manuelle
const dnsLookup = promisify(dns.lookup);

/**
 * Pool spécialisée Railway avec résolution IPv4 forcée
 */
export async function createRailwayPool() {
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
    
    // Résolution DNS manuelle IPv4 FORCÉE
    let resolvedHost = url.hostname;
    try {
      console.log('🔍 Résolution DNS IPv4 forcée pour:', url.hostname);
      const { address } = await dnsLookup(url.hostname, { family: 4 });
      resolvedHost = address;
      console.log('✅ IPv4 résolu:', resolvedHost);
    } catch (dnsError) {
      console.log('⚠️  Échec résolution IPv4, utilisation hostname original:', dnsError.message);
      resolvedHost = url.hostname;
    }
    
    const poolConfig = {
      host: resolvedHost, // Utiliser l'IP IPv4 résolue
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
      // Forcer IPv4 via family (doublement sûr)
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