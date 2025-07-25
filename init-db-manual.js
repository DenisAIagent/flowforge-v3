#!/usr/bin/env node

/**
 * Script manuel d'initialisation de la base de données
 * À utiliser si le postbuild a échoué
 */

import fs from 'fs';
import path from 'path';
import pool from './src/db/pool.js';

async function initDbManual() {
  console.log('🔧 Initialisation manuelle de la base de données...');
  
  try {
    // Tester la connexion d'abord
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Connexion DB confirmée:', testResult.rows[0].current_time);
    
    // Lire et exécuter le schéma
    const schemaPath = path.join(process.cwd(), 'src/db/auth-schema.sql');
    console.log('📄 Lecture du schéma:', schemaPath);
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('📋 Schéma lu avec succès (', schema.length, 'caractères)');
    
    // Exécuter le schéma
    console.log('🚀 Exécution du schéma...');
    await pool.query(schema);
    
    console.log('✅ Tables créées avec succès !');
    
    // Vérifier les tables créées
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Tables créées:');
    tables.rows.forEach(row => {
      console.log('   -', row.table_name);
    });
    
    // Vérifier la structure de la table users
    const usersCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    if (usersCols.rows.length > 0) {
      console.log('👥 Structure table users:');
      usersCols.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
    console.log('\n🎉 Base de données initialisée avec succès !');
    console.log('Vous pouvez maintenant tester l\'enregistrement d\'utilisateurs.');
    
  } catch (error) {
    console.error('❌ Erreur initialisation manuelle:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter l'initialisation
initDbManual();