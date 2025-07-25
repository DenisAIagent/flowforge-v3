#!/usr/bin/env node

/**
 * Script d'initialisation de la base de données FlowForge
 * Exécute le schéma d'authentification
 */

import fs from 'fs';
import path from 'path';
import pool from './src/db/pool.js';
import { config } from './src/config.js';

async function initDatabase() {
  console.log('🚀 Initialisation de la base de données FlowForge...');
  
  try {
    // Lire le fichier de schéma
    const schemaPath = path.join(process.cwd(), 'src/db/auth-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Lecture du schéma auth-schema.sql...');
    
    // Exécuter le schéma
    await pool.query(schema);
    
    console.log('✅ Base de données initialisée avec succès !');
    console.log('📊 Tables créées:');
    console.log('   - users (utilisateurs approuvés)');
    console.log('   - access_requests (demandes d\'accès)');
    console.log('   - user_sessions (sessions actives)');
    
    // Vérifier les tables créées
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'access_requests', 'user_sessions')
      ORDER BY table_name
    `);
    
    console.log('📋 Tables confirmées:', result.rows.map(row => row.table_name));
    
    // Vérifier si l'admin existe
    const adminCheck = await pool.query('SELECT email, role FROM users WHERE role = $1', ['admin']);
    if (adminCheck.rows.length > 0) {
      console.log('👤 Compte administrateur:', adminCheck.rows[0].email);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
    console.error('💡 Assurez-vous que:');
    console.error('   - DATABASE_URL est configurée');
    console.error('   - La base de données PostgreSQL est accessible');
    console.error('   - Les permissions sont correctes');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
}

export { initDatabase };