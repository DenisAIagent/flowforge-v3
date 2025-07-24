import fetch from 'node-fetch';
import pool from './db/pool.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { SUPPORTED_SERVICES } from './integrations.js';
import { agentManager } from './agent-manager.js';

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

      // Message de bienvenue (transformé pour les agents IA)
      await this.addMessage(conversation.id, 'assistant', 
        `🤖 **Bonjour ! Je suis votre assistant IA spécialisé dans la création d'agents intelligents.**

Je peux créer pour vous des agents IA autonomes qui automatisent des tâches complexes, comme String.com :

**✨ Exemples d'agents que je peux créer :**
• 📧 **Agent Email Intelligent** - Catégorise, répond automatiquement
• 📊 **Agent d'Analyse** - Compile rapports, surveille KPIs  
• 🔔 **Agent de Monitoring** - Surveille mentions, événements
• 💬 **Agent Communication** - Gère Slack, Discord automatiquement
• 🗓️ **Agent Programmé** - Exécute tâches selon planning

**Dites-moi simplement ce que vous voulez automatiser !**

Par exemple : "Je veux un agent qui surveille mes emails Gmail et créé automatiquement des tickets dans Linear pour les demandes urgentes"`
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

      // Analyser la réponse pour détecter si un agent doit être créé
      const agentData = this.extractAgentFromResponse(assistantResponse);

      let metadata = {};
      if (agentData) {
        // Créer l'agent IA si les informations sont complètes
        try {
          const agent = await this.createAgentFromData(agentData, userId);
          metadata.agent_created = agent;
          
          // Mettre à jour le contexte de la conversation
          await pool.query(
            'UPDATE chat_conversations SET workflow_context = $1 WHERE id = $2',
            [JSON.stringify({ 
              last_agent: agent.id,
              agent_type: agent.agent_type,
              capabilities: agentData.capabilities
            }), conversation.id]
          );
        } catch (agentError) {
          logger.error({ error: agentError }, 'Erreur création agent depuis chat');
          metadata.agent_error = agentError.message;
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

  // Construire le prompt système pour l'assistant (transformé pour les agents IA)
  buildSystemPrompt(userIntegrations) {
    const availableServices = userIntegrations.map(int => int.service_name).join(', ');
    
    return `Vous êtes un assistant IA spécialisé dans la création d'AGENTS INTELLIGENTS, comme String.com.

VOTRE NOUVEAU RÔLE:
- Créer des agents IA autonomes qui automatisent des tâches complexes
- Générer du code JavaScript intelligent pour chaque agent
- Concevoir des agents qui apprennent et s'adaptent
- Transformer les demandes en langage naturel en agents opérationnels

SERVICES DISPONIBLES:
${availableServices || 'Aucune intégration configurée'}
- Gmail (email automation, monitoring, smart responses)
- Slack/Discord (team communication, alerts, bot responses)  
- Google Sheets (data analysis, automated reporting)
- GitHub (issue management, PR automation)
- Brevo (email marketing, campaigns)
- Claude (AI analysis, content generation)

TYPES D'AGENTS À CRÉER:
1. **Agents de Monitoring** - Surveillent emails, mentions, événements
2. **Agents d'Automation** - Automatisent tâches répétitives
3. **Agents d'Analyse** - Analysent données et génèrent insights  
4. **Agents de Communication** - Gèrent interactions et notifications
5. **Agents Programmés** - Exécutent des tâches selon planning

QUAND CRÉER UN AGENT:
Si l'utilisateur dit des choses comme:
- "Je veux un agent qui surveille mes emails et..."
- "Crée-moi un bot qui répond automatiquement..."
- "J'ai besoin d'automatiser..."
- "Peux-tu faire un agent pour..."

ALORS générez un JSON d'agent avec cette structure:
\`\`\`json
{
  "agent_type": "create_agent",
  "name": "Nom descriptif de l'agent",
  "description": "Description détaillée de ce que fait l'agent",
  "agent_category": "monitoring|automation|analysis|communication|scheduled",
  "capabilities": ["email_processing", "ai_analysis", "messaging", "data_analysis"],
  "execution_type": "autonomous|reactive|scheduled",
  "generated_code": "// Code JavaScript de l'agent...",
  "configuration": {
    "interval_minutes": 60,
    "triggers": ["new_email", "mention", "schedule"],
    "parameters": {}
  }
}
\`\`\`

GÉNÉRATION DE CODE:
Créez du code JavaScript moderne qui utilise les APIs disponibles:
- \`await apis.sendEmail(to, subject, content)\`
- \`await apis.sendSlackMessage(channel, message)\`
- \`await apis.analyzeWithClaude(prompt, data)\`
- \`await apis.getUnreadEmails()\`
- \`await apis.appendToSheet(id, range, values)\`

EXEMPLES D'AGENTS:
1. **Agent de Catégorisation d'Emails**: Lit les emails, les catégorise avec IA
2. **Agent de Surveillance de Marque**: Monitor mentions et répond intelligemment  
3. **Agent de Reporting**: Compile données et envoie rapports automatiquement
4. **Agent Support Client**: Répond aux questions courantes automatiquement

INSTRUCTIONS:
1. Analysez la demande pour identifier le type d'agent nécessaire
2. Posez des questions pour clarifier les besoins spécifiques
3. Générez le code d'agent complet et fonctionnel
4. Proposez des améliorations et évolutions possibles
5. Expliquez comment l'agent va fonctionner en pratique

ATTENTION: Vous créez des AGENTS INTELLIGENTS, pas des workflows simples!`;
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

  // Extraire les données d'agent de la réponse
  extractAgentFromResponse(response) {
    try {
      // Chercher un bloc JSON dans la réponse
      const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        const agentData = JSON.parse(jsonMatch[1]);
        if (agentData.agent_type === 'create_agent') {
          return agentData;
        }
      }

      // Chercher un JSON sans bloc de code pour agents
      const directJsonMatch = response.match(/\{[\s\S]*"agent_type"[\s\S]*\}/);
      if (directJsonMatch) {
        const agentData = JSON.parse(directJsonMatch[0]);
        if (agentData.agent_type === 'create_agent') {
          return agentData;
        }
      }

      // Fallback: chercher d'anciens workflows et les ignorer
      const workflowMatch = response.match(/\{[\s\S]*"action_key"[\s\S]*\}/);
      if (workflowMatch) {
        logger.debug('Ancien format workflow détecté, ignoré au profit des agents');
        return null;
      }

      return null;
    } catch (error) {
      logger.debug({ error }, 'Pas de JSON d\'agent valide trouvé dans la réponse');
      return null;
    }
  }

  // Créer un agent IA à partir des données extraites
  async createAgentFromData(agentData, userId) {
    try {
      // Valider les données d'agent
      if (!agentData.name || !agentData.description || !agentData.generated_code) {
        throw new Error('Données d\'agent incomplètes - nom, description et code requis');
      }

      // Valider les capabilities
      if (!agentData.capabilities || !Array.isArray(agentData.capabilities)) {
        throw new Error('Les capabilities de l\'agent doivent être un tableau');
      }

      // Construire les données pour l'agent manager
      const agentCreationData = {
        name: agentData.name,
        description: agentData.description,
        agentType: agentData.execution_type || agentData.agent_category || 'autonomous',
        capabilities: agentData.capabilities,
        generatedCode: agentData.generated_code,
        configuration: {
          ...agentData.configuration,
          interval_minutes: agentData.configuration?.interval_minutes || 60,
          triggers: agentData.configuration?.triggers || [],
          category: agentData.agent_category
        }
      };

      // Créer l'agent via l'agent manager
      const agent = await agentManager.createAgent(userId, agentCreationData);

      logger.info({ 
        user_id: userId, 
        agent_id: agent.id,
        agent_type: agent.agent_type,
        capabilities: agentData.capabilities
      }, 'Agent IA créé depuis chat');

      return agent;
    } catch (error) {
      logger.error({ error, user_id: userId }, 'Erreur création agent depuis chat');
      throw error;
    }
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

    if (response.includes('agent')) {
      actions.push({
        type: 'view_agents',
        label: 'Voir mes agents IA',
        url: '/agents'
      });
    }

    if (response.includes('workflow')) {
      actions.push({
        type: 'view_workflows', 
        label: 'Voir mes workflows (legacy)',
        url: '/workflows'
      });
    }

    // Nouvelles actions spécifiques aux agents
    if (response.includes('déployer') || response.includes('deploy')) {
      actions.push({
        type: 'deploy_agent',
        label: 'Déployer l\'agent',
        url: '/agents'
      });
    }

    if (response.includes('monitoring') || response.includes('surveillance')) {
      actions.push({
        type: 'agent_monitoring',
        label: 'Tableau de monitoring',
        url: '/agents/monitoring'
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

