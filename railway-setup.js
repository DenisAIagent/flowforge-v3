#!/usr/bin/env node

/**
 * Script de setup complet pour Railway
 * Initialise la base de données et crée le superadmin
 */

import { initDatabase } from './init-db.js';
import { migrateAuthEmail } from './migrate-auth-email.js';
import { createSuperAdmin } from './create-superadmin.js';

async function railwaySetup() {
  console.log('🚀 Setup complet FlowForge sur Railway...');
  
  try {
    // 1. Initialiser la base de données
    console.log('\n📋 Étape 1: Initialisation de la base de données');
    await initDatabase();
    
    // 2. Appliquer les migrations email
    console.log('\n📋 Étape 2: Migration authentification email');
    await migrateAuthEmail();
    
    // 3. Créer le superadmin
    console.log('\n📋 Étape 3: Création du SuperAdmin');
    await createSuperAdmin();
    
    console.log('\n🎉 Setup Railway terminé avec succès !');
    console.log('\n🔐 IDENTIFIANTS SUPERADMIN:');
    console.log('📧 Email: admin@flowforge.com');
    console.log('🔑 Mot de passe: FlowForge2025!Admin');
    
    console.log('\n🌐 FlowForge est prêt à utiliser sur Railway !');
    
  } catch (error) {
    console.error('❌ Erreur setup Railway:', error.message);
    
    console.log('\n💡 Variables d\'environnement requises:');
    console.log('   DATABASE_URL (PostgreSQL Railway)');
    console.log('   ENCRYPTION_KEY (clé unique)'); 
    console.log('   CLAUDE_API_KEY (optionnel)');
    console.log('   SESSION_SECRET (clé session)');
    
    console.log('\n💡 Variables optionnelles:');
    console.log('   GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (OAuth)');
    console.log('   SMTP_* (envoi emails)');
    
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  railwaySetup();
}

export { railwaySetup };