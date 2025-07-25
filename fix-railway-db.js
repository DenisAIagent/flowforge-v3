#!/usr/bin/env node

/**
 * Script d'urgence pour diagnostiquer et corriger la connexion Railway DB
 */

console.log('🚨 Diagnostic Railway Database Connection');
console.log('==========================================');

console.log('\n📋 Variables d\'environnement:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL ? 'présente' : 'absente');
console.log('DATABASE_URL présente:', !!process.env.DATABASE_URL);

if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log('\n🔍 Analyse DATABASE_URL:');
    console.log('Protocol:', url.protocol);
    console.log('Hostname:', url.hostname);
    console.log('Port:', url.port);
    console.log('Database:', url.pathname.substring(1));
    console.log('Username:', url.username ? 'présent' : 'absent');
    console.log('Password:', url.password ? 'présent' : 'absent');
    
    // Détecter IPv6
    if (url.hostname.includes(':')) {
      console.log('\n⚠️  PROBLÈME DÉTECTÉ: Hostname IPv6');
      console.log('Hostname IPv6:', url.hostname);
      console.log('Ceci cause l\'erreur ECONNREFUSED');
      
      console.log('\n💡 Solutions possibles:');
      console.log('1. Vérifier addon PostgreSQL Railway');
      console.log('2. Recréer l\'addon PostgreSQL');
      console.log('3. Contacter support Railway');
    } else {
      console.log('✅ Hostname semble être IPv4/DNS standard');
    }
    
  } catch (error) {
    console.log('\n❌ DATABASE_URL invalide:', error.message);
  }
} else {
  console.log('\n❌ DATABASE_URL manquante !');
  console.log('💡 Ajoutez un addon PostgreSQL sur Railway');
}

console.log('\n🏁 Diagnostic terminé');
console.log('Vérifiez les logs ci-dessus pour identifier le problème');