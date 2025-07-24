#!/usr/bin/env node

// Test simple de démarrage de l'application
import { config } from './src/config.js';
import { logger } from './src/utils/logger.js';

console.log('🧪 Test de démarrage FlowForge...');

try {
  // Test import des modules principaux
  const { default: pool } = await import('./src/db/pool.js');
  console.log('✅ Pool de base de données importé');
  
  const { authManager } = await import('./src/auth.js');
  console.log('✅ Auth manager importé');
  
  const { chatManager } = await import('./src/chat.js');
  console.log('✅ Chat manager importé');
  
  const { agentManager } = await import('./src/agent-manager.js');
  console.log('✅ Agent manager importé');
  
  // Test de connexion base de données
  console.log('🔍 Test connexion base de données...');
  const result = await pool.query('SELECT NOW() as current_time');
  console.log('✅ Base de données connectée:', result.rows[0].current_time);
  
  console.log('🎉 Tous les modules se chargent correctement !');
  console.log('📋 Configuration actuelle:', {
    port: config.port,
    nodeEnv: config.nodeEnv,
    isRailway: config.isRailway,
    databaseConfigured: !!config.databaseUrl
  });
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Erreur de démarrage:', error.message);
  console.error(error.stack);
  process.exit(1);
}