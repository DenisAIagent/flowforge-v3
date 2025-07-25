#!/usr/bin/env node

/**
 * Script pour créer un compte superadmin FlowForge
 * Identifiants prédéfinis pour accès administrateur
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import pool from './src/db/pool.js';

// IDENTIFIANTS SUPERADMIN
const SUPERADMIN_CREDENTIALS = {
  email: 'admin@flowforge.com',
  password: 'FlowForge2025!Admin', // Mot de passe sécurisé
  firstName: 'Super',
  lastName: 'Admin',
  role: 'admin'
};

async function createSuperAdmin() {
  console.log('🔐 Creation du compte SuperAdmin FlowForge...');
  console.log('📧 Email:', SUPERADMIN_CREDENTIALS.email);
  console.log('🔑 Mot de passe:', SUPERADMIN_CREDENTIALS.password);
  
  try {
    // Vérifier si le superadmin existe déjà
    const existing = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [SUPERADMIN_CREDENTIALS.email]
    );
    
    if (existing.rows.length > 0) {
      console.log('⚠️  SuperAdmin existe déjà !');
      
      // Mettre à jour le mot de passe
      const passwordHash = await bcrypt.hash(SUPERADMIN_CREDENTIALS.password, 12);
      await pool.query(`
        UPDATE users 
        SET password_hash = $1, 
            auth_method = 'both',
            email_verified = TRUE,
            status = 'active',
            role = 'admin',
            updated_at = NOW()
        WHERE email = $2
      `, [passwordHash, SUPERADMIN_CREDENTIALS.email]);
      
      console.log('✅ Mot de passe SuperAdmin mis à jour !');
    } else {
      // Créer le superadmin
      const userId = uuidv4();
      const passwordHash = await bcrypt.hash(SUPERADMIN_CREDENTIALS.password, 12);
      
      await pool.query(`
        INSERT INTO users (
          id, email, first_name, last_name, password_hash,
          auth_method, email_verified, status, role, created_at
        )
        VALUES ($1, $2, $3, $4, $5, 'both', TRUE, 'active', 'admin', NOW())
      `, [
        userId,
        SUPERADMIN_CREDENTIALS.email,
        SUPERADMIN_CREDENTIALS.firstName,
        SUPERADMIN_CREDENTIALS.lastName,
        passwordHash
      ]);
      
      console.log('✅ SuperAdmin créé avec succès !');
    }
    
    // Afficher les informations de connexion
    console.log('\n🎯 IDENTIFIANTS DE CONNEXION:');
    console.log('=' .repeat(50));
    console.log(`📧 Email: ${SUPERADMIN_CREDENTIALS.email}`);
    console.log(`🔑 Mot de passe: ${SUPERADMIN_CREDENTIALS.password}`);
    console.log('=' .repeat(50));
    
    console.log('\n🚀 UTILISATION:');
    console.log('1. Allez sur FlowForge');
    console.log('2. Cliquez sur "Email / Mot de passe"');
    console.log('3. Utilisez les identifiants ci-dessus');
    console.log('4. Accès admin complet au dashboard !');
    
    // Statistiques
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users
      FROM users
    `);
    
    const data = stats.rows[0];
    console.log('\n📊 STATISTIQUES:');
    console.log(`👥 Total utilisateurs: ${data.total_users}`);
    console.log(`🛡️  Administrateurs: ${data.admin_users}`);
    console.log(`✅ Actifs: ${data.active_users}`);
    
  } catch (error) {
    console.error('❌ Erreur création SuperAdmin:', error.message);
    console.error('\n💡 Solutions:');
    console.error('• Vérifiez que DATABASE_URL est configuré');
    console.error('• Exécutez "npm run db:init" d\'abord');
    console.error('• Exécutez "npm run db:migrate-email" pour les colonnes');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  createSuperAdmin();
}

export { createSuperAdmin, SUPERADMIN_CREDENTIALS };