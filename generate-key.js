#!/usr/bin/env node

/**
 * Script utilitaire pour générer une clé de chiffrement sécurisée
 * Usage: node generate-key.js
 */

import crypto from 'crypto';

// Générer une clé de 32 bytes (256 bits) pour AES-256
const key = crypto.randomBytes(32).toString('base64');

console.log('🔐 Clé de chiffrement générée avec succès !');
console.log('');
console.log('Copiez cette ligne dans votre fichier .env :');
console.log(`ENCRYPTION_KEY=${key}`);
console.log('');
console.log('⚠️  IMPORTANT : Gardez cette clé secrète et ne la partagez jamais !');
console.log('⚠️  Si vous perdez cette clé, vous ne pourrez plus déchiffrer vos tokens existants.');
console.log('');

// Vérification de la longueur
const keyBuffer = Buffer.from(key, 'base64');
console.log(`✅ Longueur de la clé : ${keyBuffer.length} bytes (${keyBuffer.length * 8} bits)`);

if (keyBuffer.length === 32) {
  console.log('✅ La clé est valide pour AES-256-GCM');
} else {
  console.error('❌ Erreur : La clé devrait faire 32 bytes');
  process.exit(1);
}

