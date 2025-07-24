import crypto from 'crypto';
import pool from './db/pool.js';
import { logger } from './utils/logger.js';

// Utilitaires de hachage de mot de passe (simple pour l'exemple, utiliser bcrypt en production)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export class AuthManager {
  // Créer un nouvel utilisateur
  async createUser(userData) {
    const { email, password, firstName, lastName, role = 'user' } = userData;
    
    try {
      // Vérifier si l'email existe déjà
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }

      // Hacher le mot de passe
      const passwordHash = hashPassword(password);
      const verificationToken = generateToken();

      // Créer l'utilisateur
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, verification_token)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name, role, status, created_at`,
        [email.toLowerCase(), passwordHash, firstName, lastName, role, verificationToken]
      );

      const user = result.rows[0];
      logger.info({ user_id: user.id, email: user.email }, 'Nouvel utilisateur créé');
      
      return {
        user,
        verificationToken
      };
    } catch (error) {
      logger.error({ error, email }, 'Erreur création utilisateur');
      throw error;
    }
  }

  // Authentifier un utilisateur
  async authenticateUser(email, password) {
    try {
      const result = await pool.query(
        'SELECT id, email, password_hash, first_name, last_name, role, status, email_verified FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        throw new Error('Email ou mot de passe incorrect');
      }

      const user = result.rows[0];

      if (user.status !== 'active') {
        throw new Error('Compte utilisateur désactivé');
      }

      if (!verifyPassword(password, user.password_hash)) {
        throw new Error('Email ou mot de passe incorrect');
      }

      // Mettre à jour la dernière connexion
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      logger.info({ user_id: user.id, email: user.email }, 'Utilisateur authentifié');
      
      // Retourner les infos utilisateur sans le hash du mot de passe
      const { password_hash, ...userInfo } = user;
      return userInfo;
    } catch (error) {
      logger.error({ error, email }, 'Erreur authentification');
      throw error;
    }
  }

  // Créer une session utilisateur
  async createSession(userId, ipAddress, userAgent) {
    try {
      const sessionToken = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

      await pool.query(
        `INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, sessionToken, expiresAt, ipAddress, userAgent]
      );

      logger.info({ user_id: userId }, 'Session créée');
      return { sessionToken, expiresAt };
    } catch (error) {
      logger.error({ error, user_id: userId }, 'Erreur création session');
      throw error;
    }
  }

  // Valider une session
  async validateSession(sessionToken) {
    try {
      const result = await pool.query(
        `SELECT s.user_id, s.expires_at, u.email, u.first_name, u.last_name, u.role, u.status
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.status = 'active'`,
        [sessionToken]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const session = result.rows[0];
      logger.debug({ user_id: session.user_id }, 'Session validée');
      
      return {
        userId: session.user_id,
        email: session.email,
        firstName: session.first_name,
        lastName: session.last_name,
        role: session.role,
        status: session.status
      };
    } catch (error) {
      logger.error({ error, session_token: sessionToken }, 'Erreur validation session');
      return null;
    }
  }

  // Supprimer une session (déconnexion)
  async destroySession(sessionToken) {
    try {
      const result = await pool.query(
        'DELETE FROM user_sessions WHERE session_token = $1 RETURNING user_id',
        [sessionToken]
      );

      if (result.rows.length > 0) {
        logger.info({ user_id: result.rows[0].user_id }, 'Session supprimée');
      }
    } catch (error) {
      logger.error({ error, session_token: sessionToken }, 'Erreur suppression session');
    }
  }

  // Nettoyer les sessions expirées
  async cleanupExpiredSessions() {
    try {
      const result = await pool.query(
        'DELETE FROM user_sessions WHERE expires_at < NOW()'
      );
      
      if (result.rowCount > 0) {
        logger.info({ count: result.rowCount }, 'Sessions expirées nettoyées');
      }
    } catch (error) {
      logger.error({ error }, 'Erreur nettoyage sessions');
    }
  }

  // Lister les utilisateurs (admin seulement)
  async listUsers(requestingUserId, requestingUserRole) {
    if (requestingUserRole !== 'admin') {
      throw new Error('Accès non autorisé');
    }

    try {
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, role, status, email_verified, last_login, created_at
         FROM users 
         ORDER BY created_at DESC`
      );

      return result.rows;
    } catch (error) {
      logger.error({ error, requesting_user: requestingUserId }, 'Erreur listage utilisateurs');
      throw error;
    }
  }

  // Mettre à jour un utilisateur
  async updateUser(userId, updates, requestingUserId, requestingUserRole) {
    // Vérifier les permissions
    if (requestingUserRole !== 'admin' && requestingUserId !== userId) {
      throw new Error('Accès non autorisé');
    }

    try {
      const allowedFields = ['first_name', 'last_name', 'email'];
      if (requestingUserRole === 'admin') {
        allowedFields.push('role', 'status');
      }

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        throw new Error('Aucun champ valide à mettre à jour');
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(userId);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, first_name, last_name, role, status, updated_at
      `;

      const result = await pool.query(query, updateValues);

      if (result.rows.length === 0) {
        throw new Error('Utilisateur non trouvé');
      }

      logger.info({ user_id: userId, updated_by: requestingUserId }, 'Utilisateur mis à jour');
      return result.rows[0];
    } catch (error) {
      logger.error({ error, user_id: userId }, 'Erreur mise à jour utilisateur');
      throw error;
    }
  }

  // Changer le mot de passe
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Vérifier le mot de passe actuel
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Utilisateur non trouvé');
      }

      if (!verifyPassword(currentPassword, result.rows[0].password_hash)) {
        throw new Error('Mot de passe actuel incorrect');
      }

      // Hacher le nouveau mot de passe
      const newPasswordHash = hashPassword(newPassword);

      // Mettre à jour le mot de passe
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Supprimer toutes les sessions existantes pour forcer une reconnexion
      await pool.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );

      logger.info({ user_id: userId }, 'Mot de passe changé');
    } catch (error) {
      logger.error({ error, user_id: userId }, 'Erreur changement mot de passe');
      throw error;
    }
  }

  // Vérifier les permissions
  async checkPermission(userId, resourceType, resourceId, permission) {
    try {
      // Les admins ont tous les droits
      const userResult = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length > 0 && userResult.rows[0].role === 'admin') {
        return true;
      }

      // Vérifier les permissions spécifiques
      const permResult = await pool.query(
        `SELECT id FROM user_permissions 
         WHERE user_id = $1 AND resource_type = $2 AND (resource_id = $3 OR resource_id IS NULL) AND permission = $4`,
        [userId, resourceType, resourceId, permission]
      );

      return permResult.rows.length > 0;
    } catch (error) {
      logger.error({ error, user_id: userId }, 'Erreur vérification permission');
      return false;
    }
  }
}

export const authManager = new AuthManager();

