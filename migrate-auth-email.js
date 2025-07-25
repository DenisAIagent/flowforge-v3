#!/usr/bin/env node

/**
 * Script de migration pour ajouter l'authentification email/mot de passe
 * Ajoute les nouvelles colonnes à la table users existante
 */

import pool from './src/db/pool.js';

async function migrateAuthEmail() {
  console.log('🔄 Migration: Ajout authentification email/mot de passe...');
  
  try {
    // Ajouter les nouvelles colonnes à la table users
    await pool.query(`
      -- Ajouter colonnes pour auth email si elles n'existent pas
      DO $$ 
      BEGIN
        -- Mot de passe hashé
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
          ALTER TABLE users ADD COLUMN password_hash TEXT;
        END IF;
        
        -- Vérification email
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified') THEN
          ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        END IF;
        
        -- Token de vérification email
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='verification_token') THEN
          ALTER TABLE users ADD COLUMN verification_token VARCHAR(255) UNIQUE;
        END IF;
        
        -- Token reset mot de passe
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_password_token') THEN
          ALTER TABLE users ADD COLUMN reset_password_token VARCHAR(255) UNIQUE;
        END IF;
        
        -- Expiration token reset
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_password_expires') THEN
          ALTER TABLE users ADD COLUMN reset_password_expires TIMESTAMP WITH TIME ZONE;
        END IF;
        
        -- Méthode d'authentification
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='auth_method') THEN
          ALTER TABLE users ADD COLUMN auth_method VARCHAR(20) DEFAULT 'email' CHECK (auth_method IN ('email', 'google', 'both'));
        END IF;
      END $$;
    `);
    
    // Mettre à jour les contraintes de status pour inclure 'pending'
    await pool.query(`
      -- Mettre à jour la contrainte de status
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
      ALTER TABLE users ADD CONSTRAINT users_status_check 
        CHECK (status IN ('active', 'inactive', 'banned', 'pending'));
    `);
    
    // Mettre à jour les utilisateurs Google existants
    await pool.query(`
      UPDATE users 
      SET auth_method = 'google', email_verified = TRUE 
      WHERE google_id IS NOT NULL AND auth_method IS NULL;
    `);
    
    // Créer les nouveaux index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
      CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `);
    
    console.log('✅ Migration réussie !');
    console.log('📋 Nouvelles fonctionnalités:');
    console.log('   - Authentification par email/mot de passe');
    console.log('   - Vérification email obligatoire');
    console.log('   - Réinitialisation mot de passe');
    console.log('   - Support des deux méthodes (Google + Email)');
    
    // Statistiques
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN auth_method = 'google' THEN 1 END) as google_users,
        COUNT(CASE WHEN auth_method = 'email' THEN 1 END) as email_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_users
      FROM users
    `);
    
    const data = stats.rows[0];
    console.log('📊 Statistiques:');
    console.log(`   - Total utilisateurs: ${data.total_users}`);
    console.log(`   - Google OAuth: ${data.google_users}`);
    console.log(`   - Email/Password: ${data.email_users}`);
    console.log(`   - Actifs: ${data.active_users}`);
    console.log(`   - En attente: ${data.pending_users}`);
    
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
    console.error('💡 Assurez-vous que:');
    console.error('   - DATABASE_URL est configurée');
    console.error('   - La base de données est accessible');
    console.error('   - La table users existe (run npm run db:init first)');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateAuthEmail();
}

export { migrateAuthEmail };