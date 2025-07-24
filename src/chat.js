import fetch from 'node-fetch';
import pool from './db/pool.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { SUPPORTED_SERVICES } from './integrations.js';

const ALLOWED_COMPONENTS = [
  'discord_webhook-send_message',
  'slack-send_message',
  'github-create_issue',
  'google-sheets-append',
  'email-send',
  'http-request'
];

export class ChatManager {
  // Démarrer une nouvelle conversation
  async startConversation(userId) {
    try {
      const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await pool.query(
        `INSERT INTO chat_conversations (user_id, session_id, status, workflow_context)
         VALUES ($1, $2, 'active', '{}')
         RETURNING id, session_id`,
        [userId, sessionId]
      );

      const conversation = result.rows[0];

      // Message de bienvenue
      await this.addMessage(conversation.id, 'assistant', 
        'Bonjour ! Je suis votre assistant pour créer des workflows d\'automatisation. Décrivez-moi ce que vous souhaitez automatiser et je vous aiderai à configurer le workflow approprié.'
      );

      logger.info({ user_id: userId, conversation_id: conversation.id }, 'Nouvelle conversation démarrée');
      return conversation;
    } catch (error) {
      logger.error({ error, user_id: userId }, 'Erreur démarrage conversation');
      throw error;
    }
  }

  // Obtenir une conversation existante
  async getConversation(sessionId, userId) {
    try {
      const result = await pool.query(
        `SELECT id, session_id, status, workflow_context, created_at, updated_at
         FROM chat_conversations 
         WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Conversation non trouvée');
      }

      const conversation = result.rows[0];
      conversation.workflow_context = JSON.parse(conversation.workflow_context || '{}');

      return conversation;
    } catch (error) {
      logger.error({ error, session_id: sessionId, user_id: userId }, 'Erreur récupération conversation');
      throw error;
    }
  }

  // Ajouter un message à la conversation
  async addMessage(conversationId, role, content, metadata = {}) {
    try {
      const result = await pool.query(
        `INSERT INTO chat_messages (conversation_id, role, content, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING id, role, content, metadata, created_at`,
        [conversationId, role, content, JSON.stringify(metadata)]
      );

      // Mettre à jour la conversation
      await pool.query(
        'UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1',
        [conversationId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error({ error, conversation_id: conversationId }, 'Erreur ajout message');
      throw error;
    }
  }

  // Obtenir l'historique des messages
  async getMessages(conversationId, limit = 50) {
    try {
      const result = await pool.query(
        `SELECT id, role, content, metadata, created_at
         FROM chat_messages 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC 
         LIMIT $2`,
        [conversationId, limit]
      );

      return result.rows.map(msg => ({
        ...msg,
        metadata: JSON.parse(msg.metadata || '{}')
      }));
    } catch (error) {
      logger.error({ error, conversation_id: conversationId }, 'Erreur récupération messages');
      throw error;
    }
  }

  // Traiter un message utilisateur et générer une réponse
  async processUserMessage(sessionId, userId, userMessage) {
    try {
      const conversation = await this.getConversation(sessionId, userId);
      
      // Ajouter le message utilisateur
      await this.addMessage(conversation.id, 'user', userMessage);

      // Obtenir l'historique pour le contexte
      const messages = await this.getMessages(conversation.id);
      
      // Analyser le message et générer une réponse
      const response = await this.generateResponse(conversation, messages, userMessage, userId);

      // Ajouter la réponse de l'assistant
      await this.addMessage(conversation.id, 'assistant', response.content, response.metadata);

      return response;
    } catch (error) {
      logger.error({ error, session_id: sessionId, user_id: userId }, 'Erreur traitement message');
      throw error;
    }
  }

  // Générer une réponse intelligente
  async generateResponse(conversation, messages, userMessage, userId) {
    try {
      // Construire le contexte de la conversation
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Obtenir les intégrations disponibles pour l'utilisateur
      const userIntegrations = await this.getUserIntegrations(userId);
      
      // Système de prompt pour l'assistant conversationnel
      const systemPrompt = this.buildSystemPrompt(userIntegrations);

      // Appeler Claude pour générer la réponse
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          system: systemPrompt,
          messages: conversationHistory,
          max_tokens: 1000
        })
      });

      if (!claudeResponse.ok) {
        throw new Error(`Erreur API Claude: ${claudeResponse.status}`);
      }

      const claudeData = await claudeResponse.json();
      const assistantResponse = claudeData.content[0].text;

      // Analyser la réponse pour détecter si un workflow doit être créé
      const workflowData = this.extractWorkflowFromResponse(assistantResponse);

      let metadata = {};
      if (workflowData) {
        // Créer le workflow si les informations sont complètes
        try {
          const workflow = await this.createWorkflowFromData(workflowData, userId);
          metadata.workflow_created = workflow;
          
          // Mettre à jour le contexte de la conversation
          await pool.query(
            'UPDATE chat_conversations SET workflow_context = $1 WHERE id = $2',
            [JSON.stringify({ last_workflow: workflow.id }), conversation.id]
          );
        } catch (workflowError) {
          logger.error({ error: workflowError }, 'Erreur création workflow depuis chat');
          metadata.workflow_error = workflowError.message;
        }
      }

      return {
        content: assistantResponse,
        metadata,
        needs_clarification: this.needsClarification(assistantResponse),
        suggested_actions: this.extractSuggestedActions(assistantResponse)
      };

    } catch (error) {
      logger.error({ error }, 'Erreur génération réponse');
      
      // Réponse de fallback
      return {
        content: 'Je rencontre une difficulté technique. Pouvez-vous reformuler votre demande ?',
        metadata: { error: error.message },
        needs_clarification: true
      };
    }
  }

  // Construire le prompt système pour l'assistant
  buildSystemPrompt(userIntegrations) {
    const availableServices = userIntegrations.map(int => int.service_name).join(', ');
    
    return `Vous êtes un assistant spécialisé dans la création de workflows d'automatisation.

VOTRE RÔLE:
- Aider l'utilisateur à définir clairement ses besoins d'automatisation
- Poser des questions de clarification pertinentes
- Proposer des solutions techniques appropriées
- Créer des workflows quand toutes les informations sont disponibles

SERVICES DISPONIBLES POUR CET UTILISATEUR:
${availableServices || 'Aucune intégration configurée'}

COMPOSANTS SUPPORTÉS:
${ALLOWED_COMPONENTS.join(', ')}

INSTRUCTIONS:
1. Posez des questions spécifiques pour comprendre:
   - Le déclencheur (quand l'automatisation doit se lancer)
   - L'action à effectuer (que faire)
   - Les paramètres nécessaires (données à utiliser)

2. Si l'utilisateur n'a pas configuré les intégrations nécessaires, guidez-le vers la page d'intégrations

3. Quand vous avez toutes les informations, générez un JSON de workflow avec cette structure:
   {
     "name": "Nom du workflow",
     "trigger_config": {"type": "manual", "description": "Description du déclencheur"},
     "action_key": "service-action",
     "action_props": {"propriété": "valeur"}
   }

4. Soyez professionnel, précis et évitez le jargon technique inutile

5. Si l'utilisateur demande des fonctionnalités non supportées, expliquez les limitations et proposez des alternatives`;
  }

  // Obtenir les intégrations de l'utilisateur
  async getUserIntegrations(userId) {
    try {
      const result = await pool.query(
        `SELECT service_name, display_name, status
         FROM credentials 
         WHERE user_id = $1 AND status = 'active'
         ORDER BY service_name`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error({ error, user_id: userId }, 'Erreur récupération intégrations utilisateur');
      return [];
    }
  }

  // Extraire les données de workflow de la réponse
  extractWorkflowFromResponse(response) {
    try {
      // Chercher un bloc JSON dans la réponse
      const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Chercher un JSON sans bloc de code
      const directJsonMatch = response.match(/\{[\s\S]*"action_key"[\s\S]*\}/);
      if (directJsonMatch) {
        return JSON.parse(directJsonMatch[0]);
      }

      return null;
    } catch (error) {
      logger.debug({ error }, 'Pas de JSON valide trouvé dans la réponse');
      return null;
    }
  }

  // Créer un workflow à partir des données extraites
  async createWorkflowFromData(workflowData, userId) {
    // Valider les données
    if (!workflowData.name || !workflowData.action_key || !workflowData.action_props) {
      throw new Error('Données de workflow incomplètes');
    }

    if (!ALLOWED_COMPONENTS.includes(workflowData.action_key)) {
      throw new Error(`Composant non autorisé: ${workflowData.action_key}`);
    }

    // Créer le workflow
    const result = await pool.query(
      `INSERT INTO workflows (user_id, name, trigger_config, action_key, action_props)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        workflowData.name,
        workflowData.trigger_config || { type: 'manual' },
        workflowData.action_key,
        workflowData.action_props
      ]
    );

    logger.info({ user_id: userId, workflow_id: result.rows[0].id }, 'Workflow créé depuis chat');
    return result.rows[0];
  }

  // Détecter si une clarification est nécessaire
  needsClarification(response) {
    const clarificationIndicators = [
      'pouvez-vous préciser',
      'j\'ai besoin de plus d\'informations',
      'quelle est',
      'comment souhaitez-vous',
      'voulez-vous',
      '?'
    ];

    return clarificationIndicators.some(indicator => 
      response.toLowerCase().includes(indicator)
    );
  }

  // Extraire les actions suggérées
  extractSuggestedActions(response) {
    const actions = [];
    
    if (response.includes('intégration')) {
      actions.push({
        type: 'configure_integration',
        label: 'Configurer les intégrations',
        url: '/integrations'
      });
    }

    if (response.includes('workflow')) {
      actions.push({
        type: 'view_workflows',
        label: 'Voir mes workflows',
        url: '/workflows'
      });
    }

    return actions;
  }

  // Lister les conversations d'un utilisateur
  async getUserConversations(userId, limit = 20) {
    try {
      const result = await pool.query(
        `SELECT id, session_id, status, created_at, updated_at,
                (SELECT content FROM chat_messages WHERE conversation_id = chat_conversations.id ORDER BY created_at DESC LIMIT 1) as last_message
         FROM chat_conversations 
         WHERE user_id = $1 
         ORDER BY updated_at DESC 
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error({ error, user_id: userId }, 'Erreur récupération conversations utilisateur');
      throw error;
    }
  }

  // Marquer une conversation comme terminée
  async completeConversation(sessionId, userId) {
    try {
      await pool.query(
        `UPDATE chat_conversations 
         SET status = 'completed', updated_at = NOW() 
         WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
      );

      logger.info({ session_id: sessionId, user_id: userId }, 'Conversation marquée comme terminée');
    } catch (error) {
      logger.error({ error, session_id: sessionId }, 'Erreur finalisation conversation');
      throw error;
    }
  }
}

export const chatManager = new ChatManager();

