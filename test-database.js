#!/usr/bin/env node

/**
 * Test simple de connexion à la base de données Railway
 * Utilise directement process.env.DATABASE_URL sans config.js
 */

import pg from 'pg';

const { Pool } = pg;

async function testDatabase() {
  console.log('🧪 Test de connexion à la base de données...');
  console.log('📋 Variables d\'environnement:');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL ? 'présente' : 'absente');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'présente (' + process.env.DATABASE_URL.substring(0, 30) + '...)' : 'ABSENTE');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL non définie !');
    console.error('💡 Assurez-vous de configurer DATABASE_URL dans Railway');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔌 Tentative de connexion...');
    
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    
    console.log('✅ Connexion réussie !');
    console.log('⏰ Heure DB:', result.rows[0].current_time);
    console.log('🗄️ Version DB:', result.rows[0].db_version);
    
    // Test des tables
    try {
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      console.log('📊 Tables disponibles:', tables.rows.map(r => r.table_name));
      
    } catch (error) {
      console.log('⚠️ Impossible de lister les tables (DB peut-être non initialisée)');
    }
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    console.error('🔍 Code d\'erreur:', error.code);
    console.error('🔍 Détails:', error.detail || 'Aucun détail');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 La base de données refuse la connexion');
      console.error('💡 Vérifiez que DATABASE_URL pointe vers le bon serveur');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter le test
testDatabase();