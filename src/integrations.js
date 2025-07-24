import fetch from 'node-fetch';
import pool from './db/pool.js';
import { encrypt, decrypt } from './crypto.js';
import { logger } from './utils/logger.js';

// Configuration des services supportés
export const SUPPORTED_SERVICES = {
  claude: {
    name: 'Claude (Anthropic)',
    type: 'api_key',
    fields: [
      { key: 'api_key', label: 'Clé API', type: 'password', required: true }
    ],
    testEndpoint: 'https://api.anthropic.com/v1/messages',
    category: 'ai'
  },
  google: {
    name: 'Google APIs',
    type: 'oauth2',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: false }
    ],
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/gmail.send'],
    category: 'productivity'
  },
  brevo: {
    name: 'Brevo (ex-Sendinblue)',
    type: 'api_key',
    fields: [
      { key: 'api_key', label: 'Clé API', type: 'password', required: true }
    ],
    testEndpoint: 'https://api.brevo.com/v3/account',
    category: 'email'
  },
  discord: {
    name: 'Discord',
    type: 'webhook',
    fields: [
      { key: 'webhook_url', label: 'URL du Webhook', type: 'url', required: true },
      { key: 'bot_token', label: 'Token du Bot (optionnel)', type: 'password', required: false }
    ],
    category: 'communication'
  },
  slack: {
    name: 'Slack',
    type: 'oauth2',
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', required: true },
      { key: 'webhook_url', label: 'Webhook URL (optionnel)', type: 'url', required: false }
    ],
    category: 'communication'
  },
  github: {
    name: 'GitHub',
    type: 'api_key',
    fields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', required: true }
    ],
    testEndpoint: 'https://api.github.com/user',
    category: 'development'
  }
};

export class IntegrationsManager {
  // Créer ou mettre à jour une intégration
  async saveIntegration(serviceKey, displayName, credentials, config = {}, userId) {
    try {
      const service = SUPPORTED_SERVICES[serviceKey];
      if (!service) {
        throw new Error(`Service non supporté: ${serviceKey}`);
      }

      // Chiffrer les données sensibles
      const encryptedData = encrypt(JSON.stringify(credentials));

      // Vérifier si l'intégration existe déjà pour cet utilisateur
      const existing = await pool.query(
        'SELECT id FROM credentials WHERE service_name = $1 AND display_name = $2 AND user_id = $3',
        [serviceKey, displayName, userId]
      );

      let result;
      if (existing.rows.length > 0) {
        // Mise à jour
        result = await pool.query(
          `UPDATE credentials 
           SET encrypted_data = $1, config = $2, updated_at = NOW(), status = 'active'
           WHERE id = $3 
           RETURNING *`,
          [encryptedData, JSON.stringify(config), existing.rows[0].id]
        );
      } else {
        // Création
        result = await pool.query(
          `INSERT INTO credentials (user_id, service_name, service_type, display_name, encrypted_data, config)
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING *`,
          [userId, serviceKey, service.type, displayName, encryptedData, JSON.stringify(config)]
        );
      }

      logger.info({ service: serviceKey, display_name: displayName, user_id: userId }, 'Intégration sauvegardée');
      return result.rows[0];
    } catch (error) {
      logger.error({ error, service: serviceKey, user_id: userId }, 'Erreur sauvegarde intégration');
      throw error;
    }
  }

  // Lister toutes les intégrations
  async listIntegrations() {
    try {
      const result = await pool.query(
        `SELECT id, service_name, service_type, display_name, status, last_tested, created_at, updated_at
         FROM credentials 
         ORDER BY service_name, display_name`
      );

      return result.rows.map(row => ({
        ...row,
        service_info: SUPPORTED_SERVICES[row.service_name] || { name: row.service_name, category: 'other' }
      }));
    } catch (error) {
      logger.error({ error }, 'Erreur listage intégrations');
      throw error;
    }
  }

  // Obtenir une intégration spécifique (sans les credentials)
  async getIntegration(id) {
    try {
      const result = await pool.query(
        'SELECT id, service_name, service_type, display_name, config, status, last_tested, created_at FROM credentials WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Intégration non trouvée');
      }

      const integration = result.rows[0];
      return {
        ...integration,
        service_info: SUPPORTED_SERVICES[integration.service_name] || { name: integration.service_name, category: 'other' },
        config: JSON.parse(integration.config || '{}')
      };
    } catch (error) {
      logger.error({ error, id }, 'Erreur récupération intégration');
      throw error;
    }
  }

  // Obtenir les credentials déchiffrés (usage interne)
  async getCredentials(serviceKey, userId, displayName = null) {
    try {
      let query = 'SELECT encrypted_data FROM credentials WHERE service_name = $1 AND user_id = $2 AND status = $3';
      let params = [serviceKey, userId, 'active'];

      if (displayName) {
        query += ' AND display_name = $4';
        params.push(displayName);
      }

      query += ' ORDER BY created_at DESC LIMIT 1';

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error(`Aucune intégration active trouvée pour ${serviceKey}`);
      }

      const decryptedData = decrypt(result.rows[0].encrypted_data);
      return JSON.parse(decryptedData);
    } catch (error) {
      logger.error({ error, service: serviceKey, user_id: userId }, 'Erreur récupération credentials');
      throw error;
    }
  }

  // Tester une connexion
  async testConnection(id) {
    try {
      const integration = await this.getIntegration(id);
      const service = SUPPORTED_SERVICES[integration.service_name];

      if (!service || !service.testEndpoint) {
        throw new Error('Test de connexion non supporté pour ce service');
      }

      // Récupérer les credentials
      const credentialsResult = await pool.query(
        'SELECT encrypted_data FROM credentials WHERE id = $1',
        [id]
      );
      const credentials = JSON.parse(decrypt(credentialsResult.rows[0].encrypted_data));

      // Effectuer le test selon le type de service
      let testResult;
      switch (integration.service_name) {
        case 'claude':
          testResult = await this.testClaude(credentials.api_key);
          break;
        case 'brevo':
          testResult = await this.testBrevo(credentials.api_key);
          break;
        case 'github':
          testResult = await this.testGitHub(credentials.token);
          break;
        case 'discord':
          testResult = await this.testDiscord(credentials.webhook_url);
          break;
        default:
          throw new Error(`Test non implémenté pour ${integration.service_name}`);
      }

      // Mettre à jour le statut
      await pool.query(
        'UPDATE credentials SET status = $1, last_tested = NOW() WHERE id = $2',
        [testResult.success ? 'active' : 'error', id]
      );

      logger.info({ service: integration.service_name, success: testResult.success }, 'Test de connexion');
      return testResult;
    } catch (error) {
      logger.error({ error, id }, 'Erreur test de connexion');
      
      // Marquer comme erreur
      await pool.query(
        'UPDATE credentials SET status = $1, last_tested = NOW() WHERE id = $2',
        ['error', id]
      );

      return { success: false, error: error.message };
    }
  }

  // Tests spécifiques par service
  async testClaude(apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      return { success: true, message: 'Connexion Claude réussie' };
    } else {
      const error = await response.text();
      return { success: false, error: `Erreur Claude: ${error}` };
    }
  }

  async testBrevo(apiKey) {
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': apiKey
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: `Connexion Brevo réussie (${data.email})` };
    } else {
      const error = await response.text();
      return { success: false, error: `Erreur Brevo: ${error}` };
    }
  }

  async testGitHub(token) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'FlowForge'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: `Connexion GitHub réussie (${data.login})` };
    } else {
      const error = await response.text();
      return { success: false, error: `Erreur GitHub: ${error}` };
    }
  }

  async testDiscord(webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '✅ Test de connexion FlowForge réussi !',
        username: 'FlowForge'
      })
    });

    if (response.ok) {
      return { success: true, message: 'Message de test envoyé sur Discord' };
    } else {
      const error = await response.text();
      return { success: false, error: `Erreur Discord: ${error}` };
    }
  }

  // Supprimer une intégration
  async deleteIntegration(id) {
    try {
      const result = await pool.query(
        'DELETE FROM credentials WHERE id = $1 RETURNING service_name, display_name',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Intégration non trouvée');
      }

      logger.info({ id, service: result.rows[0].service_name }, 'Intégration supprimée');
      return result.rows[0];
    } catch (error) {
      logger.error({ error, id }, 'Erreur suppression intégration');
      throw error;
    }
  }
}

export const integrationsManager = new IntegrationsManager();

