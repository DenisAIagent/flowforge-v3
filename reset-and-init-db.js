#!/usr/bin/env node

/**
 * Script de reset complet et réinitialisation de la base de données
 */

import fs from 'fs';
import path from 'path';
import pool from './src/db/pool.js';

async function resetAndInitDb() {
  console.log('🔄 Reset complet et réinitialisation de la base de données...');
  
  try {
    // Test de connexion
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Connexion DB confirmée:', testResult.rows[0].current_time);
    
    // 1. Reset (supprimer toutes les tables)
    console.log('🗑️  Suppression des tables existantes...');
    const resetPath = path.join(process.cwd(), 'reset-db.sql');
    const resetSql = fs.readFileSync(resetPath, 'utf8');
    await pool.query(resetSql);
    console.log('✅ Tables supprimées avec succès');
    
    // 2. Réinitialisation (recréer toutes les tables)
    console.log('🏗️  Création des nouvelles tables...');
    const schemaPath = path.join(process.cwd(), 'src/db/auth-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('✅ Nouvelles tables créées avec succès');
    
    // 3. Vérification
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
    
    // 4. Vérifier le compte admin
    const adminCheck = await pool.query('SELECT email, role FROM users WHERE role = $1', ['admin']);
    if (adminCheck.rows.length > 0) {
      console.log('👨‍💼 Compte admin créé:', adminCheck.rows[0].email);
    }
    
    console.log('\n🎉 Base de données réinitialisée avec succès !');
    console.log('Vous pouvez maintenant tester la connexion Google OAuth.');
    
  } catch (error) {
    console.error('❌ Erreur lors du reset:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter le reset
resetAndInitDb();