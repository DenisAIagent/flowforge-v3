-- Script de reset complet de la base de données
-- ATTENTION: Supprime toutes les données existantes

-- Supprimer les contraintes et tables dans l'ordre inverse
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS access_requests CASCADE; 
DROP TABLE IF EXISTS users CASCADE;

-- Supprimer les fonctions et vues
DROP FUNCTION IF EXISTS cleanup_expired_sessions() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP VIEW IF EXISTS admin_stats CASCADE;

-- Message de confirmation
SELECT 'Base de données réinitialisée - tables supprimées' AS status;