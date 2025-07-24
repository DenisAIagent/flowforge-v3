import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'path';
import fetch from 'node-fetch';

// Configuration et logging d'abord
import { config } from './config.js';
import { logger } from './utils/logger.js';

// Database connection avec gestion d'erreur
let pool;
try {
  const poolModule = await import('./db/pool.js');
  pool = poolModule.default;
  logger.info('✅ Pool de base de données initialisé');
} catch (error) {
  logger.error({ error }, '❌ Erreur initialisation pool de base de données');
  throw error;
}

// Autres imports avec gestion d'erreurs
import { authManager } from './auth.js';
import { integrationsManager } from './integrations.js';
import { chatManager } from './chat.js';
import { agentManager } from './agent-manager.js';
import { decrypt, encrypt } from './crypto.js';

// Démarrer le scheduler seulement si tout va bien
try {
  await import('./scheduler.js');
  logger.info('✅ Scheduler initialisé');
} catch (error) {
  logger.warn({ error }, '⚠️ Scheduler non disponible');
}

const app = Fastify({ logger: true });

// Middleware d'authentification
async function authenticateRequest(request, reply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Token d\'authentification requis' });
  }

  const token = authHeader.substring(7);
  const session = await authManager.validateSession(token);
  
  if (!session) {
    return reply.code(401).send({ error: 'Session invalide ou expirée' });
  }

  request.user = session;
}

// Middleware d'autorisation admin
async function requireAdmin(request, reply) {
  if (request.user.role !== 'admin') {
    return reply.code(403).send({ error: 'Accès administrateur requis' });
  }
}

// Configuration CORS pour le développement
app.register(async function (fastify) {
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (request.method === 'OPTIONS') {
      reply.code(200).send();
    }
  });
});

// Servir les fichiers statiques
app.register(staticPlugin, {
  root: path.join(new URL('.', import.meta.url).pathname, '../public'),
  prefix: '/'
});

// Route de santé avec diagnostic complet
app.get('/health', async (request, reply) => {
  try {
    // Test de connexion à la base de données
    const dbTest = await pool.query('SELECT NOW() as current_time');
    const dbConnected = !!dbTest.rows[0];
    
    const healthData = { 
      status: 'ok',
      service: 'FlowForge v2.1 - AI Agent Platform',
      timestamp: new Date().toISOString(),
      version: '2.1.0',
      environment: config.nodeEnv,
      database: {
        connected: dbConnected,
        timestamp: dbTest.rows[0]?.current_time
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      isRailway: config.isRailway
    };
    
    reply.code(200).send(healthData);
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    reply.code(503).send({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== ROUTES D'AUTHENTIFICATION =====

// Inscription
app.post('/v1/auth/register', async (request, reply) => {
  const { firstName, lastName, email, password } = request.body;
  
  if (!firstName || !lastName || !email || !password) {
    return reply.code(400).send({ error: 'Tous les champs sont requis' });
  }

  if (password.length < 6) {
    return reply.code(400).send({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    const result = await authManager.createUser({
      firstName,
      lastName,
      email,
      password
    });

    reply.code(201).send({
      message: 'Utilisateur créé avec succès',
      user: result.user
    });
  } catch (error) {
    logger.error({ error }, 'Erreur inscription');
    reply.code(400).send({ error: error.message });
  }
});

// Connexion
app.post('/v1/auth/login', async (request, reply) => {
  const { email, password } = request.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email et mot de passe requis' });
  }

  try {
    const user = await authManager.authenticateUser(email, password);
    const session = await authManager.createSession(
      user.id,
      request.ip,
      request.headers['user-agent']
    );

    reply.send({
      message: 'Connexion réussie',
      user,
      sessionToken: session.sessionToken
    });
  } catch (error) {
    logger.error({ error, email }, 'Erreur connexion');
    reply.code(401).send({ error: error.message });
  }
});

// Validation de session
app.get('/v1/auth/validate', { preHandler: authenticateRequest }, async (request, reply) => {
  reply.send({
    valid: true,
    user: request.user
  });
});

// Déconnexion
app.post('/v1/auth/logout', { preHandler: authenticateRequest }, async (request, reply) => {
  const token = request.headers.authorization.substring(7);
  await authManager.destroySession(token);
  
  reply.send({ message: 'Déconnexion réussie' });
});

// ===== ROUTES DE CHAT =====

// Démarrer une conversation
app.post('/v1/chat/start', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const conversation = await chatManager.startConversation(request.user.userId);
    reply.send({ conversation });
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur démarrage conversation');
    reply.code(500).send({ error: 'Erreur lors du démarrage de la conversation' });
  }
});

// Obtenir les messages d'une conversation
app.get('/v1/chat/:sessionId/messages', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const conversation = await chatManager.getConversation(request.params.sessionId, request.user.userId);
    const messages = await chatManager.getMessages(conversation.id);
    reply.send(messages);
  } catch (error) {
    logger.error({ error, session_id: request.params.sessionId }, 'Erreur récupération messages');
    reply.code(404).send({ error: 'Conversation non trouvée' });
  }
});

// Envoyer un message
app.post('/v1/chat/:sessionId/message', { preHandler: authenticateRequest }, async (request, reply) => {
  const { message } = request.body;
  
  if (!message || !message.trim()) {
    return reply.code(400).send({ error: 'Message requis' });
  }

  try {
    const response = await chatManager.processUserMessage(
      request.params.sessionId,
      request.user.userId,
      message.trim()
    );
    
    reply.send(response);
  } catch (error) {
    logger.error({ error, session_id: request.params.sessionId }, 'Erreur traitement message');
    reply.code(500).send({ error: 'Erreur lors du traitement du message' });
  }
});

// Lister les conversations de l'utilisateur
app.get('/v1/chat/conversations', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const conversations = await chatManager.getUserConversations(request.user.userId);
    reply.send(conversations);
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur récupération conversations');
    reply.code(500).send({ error: 'Erreur lors de la récupération des conversations' });
  }
});

// ===== ROUTES D'INTÉGRATIONS =====

// Lister les intégrations de l'utilisateur
app.get('/v1/integrations', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const integrations = await integrationsManager.listIntegrations();
    // Filtrer par utilisateur
    const userIntegrations = integrations.filter(int => int.user_id === request.user.userId);
    reply.send(userIntegrations);
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur listage intégrations');
    reply.code(500).send({ error: 'Erreur lors de la récupération des intégrations' });
  }
});

// Créer/modifier une intégration
app.post('/v1/integrations', { preHandler: authenticateRequest }, async (request, reply) => {
  const { serviceKey, displayName, credentials, config } = request.body;
  
  if (!serviceKey || !displayName || !credentials) {
    return reply.code(400).send({ error: 'Service, nom d\'affichage et credentials requis' });
  }

  try {
    const integration = await integrationsManager.saveIntegration(
      serviceKey,
      displayName,
      credentials,
      config || {},
      request.user.userId
    );
    
    reply.code(201).send(integration);
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur sauvegarde intégration');
    reply.code(400).send({ error: error.message });
  }
});

// Obtenir l'URL d'authentification OAuth pour Google
app.get('/v1/integrations/google/oauth-url', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    // Récupérer la configuration Google de l'utilisateur
    const integration = await pool.query(
      'SELECT encrypted_data FROM credentials WHERE service_name = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      ['google', request.user.userId]
    );

    if (integration.rows.length === 0) {
      return reply.code(404).send({ error: 'Configuration Google non trouvée. Configurez d\'abord vos credentials.' });
    }

    const credentials = JSON.parse(decrypt(integration.rows[0].encrypted_data));
    
    // Construire l'URL OAuth
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/spreadsheets');
    const redirectUri = encodeURIComponent(`${config.baseUrl}/v1/integrations/google/oauth-callback`);
    const state = Buffer.from(JSON.stringify({ userId: request.user.userId })).toString('base64');
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${credentials.client_id}&` +
      `redirect_uri=${redirectUri}&` +
      `response_type=code&` +
      `scope=${scopes}&` +
      `state=${state}&` +
      `access_type=offline&` +
      `prompt=consent`;

    reply.send({ authUrl });
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur génération URL OAuth Google');
    reply.code(500).send({ error: 'Erreur lors de la génération de l\'URL OAuth' });
  }
});

// Callback OAuth pour Google
app.get('/v1/integrations/google/oauth-callback', async (request, reply) => {
  const { code, state, error } = request.query;
  
  if (error) {
    return reply.code(400).send(`
      <html>
        <body>
          <h1>❌ Erreur d'authentification</h1>
          <p>Erreur: ${error}</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return reply.code(400).send('Code ou state manquant');
  }

  try {
    // Décoder le state pour récupérer l'userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    
    // Récupérer les credentials Google
    const integration = await pool.query(
      'SELECT id, encrypted_data FROM credentials WHERE service_name = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      ['google', userId]
    );

    if (integration.rows.length === 0) {
      throw new Error('Configuration Google non trouvée');
    }

    const credentials = JSON.parse(decrypt(integration.rows[0].encrypted_data));
    
    // Échanger le code contre les tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${config.baseUrl}/v1/integrations/google/oauth-callback`
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Erreur lors de l\'échange de tokens');
    }

    const tokens = await tokenResponse.json();
    
    // Sauvegarder les tokens
    const updatedCredentials = {
      ...credentials,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000)
    };

    await pool.query(
      'UPDATE credentials SET encrypted_data = $1, status = $2, last_tested = NOW() WHERE id = $3',
      [encrypt(JSON.stringify(updatedCredentials)), 'active', integration.rows[0].id]
    );

    reply.type('text/html').send(`
      <html>
        <head>
          <title>FlowForge - Google Connecté</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #059669; }
            .logo { height: 40px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <img src="/images/logo.png" alt="FlowForge" class="logo">
          <h1 class="success">✅ Google connecté avec succès !</h1>
          <p>Vous pouvez maintenant fermer cette fenêtre et retourner à FlowForge.</p>
          <script>
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
    
    logger.info({ user_id: userId }, 'OAuth Google complété avec succès');
    
  } catch (error) {
    logger.error({ error }, 'Erreur callback OAuth Google');
    reply.type('text/html').send(`
      <html>
        <body>
          <h1>❌ Erreur de configuration</h1>
          <p>Erreur: ${error.message}</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }
});

// Tester une intégration
app.post('/v1/integrations/:id/test', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const result = await integrationsManager.testConnection(request.params.id);
    reply.send(result);
  } catch (error) {
    logger.error({ error, integration_id: request.params.id }, 'Erreur test intégration');
    reply.code(500).send({ error: 'Erreur lors du test de connexion' });
  }
});

// Supprimer une intégration
app.delete('/v1/integrations/:id', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    await integrationsManager.deleteIntegration(request.params.id);
    reply.code(204).send();
  } catch (error) {
    logger.error({ error, integration_id: request.params.id }, 'Erreur suppression intégration');
    reply.code(500).send({ error: 'Erreur lors de la suppression' });
  }
});

// ===== ROUTES D'AGENTS IA =====

// Lister les agents de l'utilisateur
app.get('/v1/agents', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_agents WHERE user_id = $1 ORDER BY created_at DESC',
      [request.user.userId]
    );
    reply.send(result.rows);
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur listage agents');
    reply.code(500).send({ error: 'Erreur lors de la récupération des agents' });
  }
});

// Obtenir un agent spécifique
app.get('/v1/agents/:id', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    );
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent non trouvé' });
    }
    
    reply.send(result.rows[0]);
  } catch (error) {
    logger.error({ error, agent_id: request.params.id }, 'Erreur récupération agent');
    reply.code(500).send({ error: 'Erreur lors de la récupération de l\'agent' });
  }
});

// Créer un agent IA manuellement
app.post('/v1/agents', { preHandler: authenticateRequest }, async (request, reply) => {
  const { name, description, agentType, capabilities, generatedCode, configuration } = request.body;
  
  if (!name || !description || !generatedCode) {
    return reply.code(400).send({ error: 'Nom, description et code requis' });
  }

  try {
    const agent = await agentManager.createAgent(request.user.userId, {
      name,
      description,
      agentType: agentType || 'autonomous',
      capabilities: capabilities || [],
      generatedCode,
      configuration: configuration || {}
    });
    
    reply.code(201).send(agent);
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur création agent');
    reply.code(500).send({ error: 'Erreur lors de la création de l\'agent' });
  }
});

// Exécuter un agent manuellement
app.post('/v1/agents/:id/execute', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const agent = await pool.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    );
    
    if (agent.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent non trouvé' });
    }
    
    const result = await agentManager.executeAgent(
      parseInt(request.params.id),
      request.body.inputData || {}
    );
    
    reply.send({
      message: 'Agent exécuté avec succès',
      result
    });
  } catch (error) {
    logger.error({ error, agent_id: request.params.id }, 'Erreur exécution agent');
    reply.code(500).send({ error: error.message });
  }
});

// Activer/désactiver un agent
app.patch('/v1/agents/:id', { preHandler: authenticateRequest }, async (request, reply) => {
  const { is_active, deployment_status } = request.body;
  
  try {
    let updateQuery = 'UPDATE ai_agents SET updated_at = NOW()';
    let updateValues = [];
    let valueIndex = 1;
    
    if (typeof is_active === 'boolean') {
      updateQuery += `, is_active = $${valueIndex}`;
      updateValues.push(is_active);
      valueIndex++;
    }
    
    if (deployment_status) {
      updateQuery += `, deployment_status = $${valueIndex}`;
      updateValues.push(deployment_status);
      valueIndex++;
    }
    
    updateQuery += ` WHERE id = $${valueIndex} AND user_id = $${valueIndex + 1} RETURNING *`;
    updateValues.push(request.params.id, request.user.userId);
    
    const result = await pool.query(updateQuery, updateValues);
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent non trouvé' });
    }
    
    reply.send(result.rows[0]);
  } catch (error) {
    logger.error({ error, agent_id: request.params.id }, 'Erreur modification agent');
    reply.code(500).send({ error: 'Erreur lors de la modification de l\'agent' });
  }
});

// Obtenir les logs d'un agent
app.get('/v1/agents/:id/logs', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const agent = await pool.query(
      'SELECT id FROM ai_agents WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    );
    
    if (agent.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent non trouvé' });
    }

    const result = await pool.query(
      'SELECT * FROM agent_logs WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 100',
      [request.params.id]
    );
    
    reply.send(result.rows);
  } catch (error) {
    logger.error({ error, agent_id: request.params.id }, 'Erreur récupération logs agent');
    reply.code(500).send({ error: 'Erreur lors de la récupération des logs' });
  }
});

// Obtenir les exécutions d'un agent
app.get('/v1/agents/:id/executions', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const agent = await pool.query(
      'SELECT id FROM ai_agents WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    );
    
    if (agent.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent non trouvé' });
    }

    const result = await pool.query(
      'SELECT * FROM agent_executions WHERE agent_id = $1 ORDER BY started_at DESC LIMIT 50',
      [request.params.id]
    );
    
    reply.send(result.rows);
  } catch (error) {
    logger.error({ error, agent_id: request.params.id }, 'Erreur récupération exécutions agent');
    reply.code(500).send({ error: 'Erreur lors de la récupération des exécutions' });
  }
});

// Supprimer un agent
app.delete('/v1/agents/:id', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    // Arrêter l'agent d'abord
    await agentManager.stopAgent(parseInt(request.params.id));
    
    const result = await pool.query(
      'DELETE FROM ai_agents WHERE id = $1 AND user_id = $2 RETURNING *',
      [request.params.id, request.user.userId]
    );
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Agent non trouvé' });
    }
    
    reply.code(204).send();
  } catch (error) {
    logger.error({ error, agent_id: request.params.id }, 'Erreur suppression agent');
    reply.code(500).send({ error: 'Erreur lors de la suppression de l\'agent' });
  }
});

// ===== ROUTES DE WORKFLOWS (legacy) =====

// Lister les workflows de l'utilisateur
app.get('/v1/workflows', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const result = await pool.query(
      'SELECT * FROM workflows WHERE user_id = $1 ORDER BY created_at DESC',
      [request.user.userId]
    );
    reply.send(result.rows);
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur listage workflows');
    reply.code(500).send({ error: 'Erreur lors de la récupération des workflows' });
  }
});

// Obtenir un workflow spécifique
app.get('/v1/workflows/:id', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const result = await pool.query(
      'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    );
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Workflow non trouvé' });
    }
    
    reply.send(result.rows[0]);
  } catch (error) {
    logger.error({ error, workflow_id: request.params.id }, 'Erreur récupération workflow');
    reply.code(500).send({ error: 'Erreur lors de la récupération du workflow' });
  }
});

// Créer un workflow depuis un prompt (legacy)
app.post('/v1/workflows/create-from-prompt', { preHandler: authenticateRequest }, async (request, reply) => {
  const { prompt } = request.body;
  
  if (!prompt) {
    return reply.code(400).send({ error: 'Le prompt est requis' });
  }

  const ALLOWED_COMPONENTS = [
    'discord_webhook-send_message',
    'slack-send_message',
    'github-create_issue',
    'google-sheets-append',
    'email-send',
    'http-request'
  ];

  const systemPrompt = `Vous êtes un expert en automatisation. Traduisez la demande de l'utilisateur en un objet JSON unique et valide pour FlowForge.
Le JSON doit contenir les clés "name", "trigger_config", "action_key", et "action_props".
Les valeurs de "action_key" doivent provenir de cette liste : ${ALLOWED_COMPONENTS.join(', ')}.
Répondez UNIQUEMENT avec le bloc de code JSON, sans aucun autre texte.`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      })
    });

    if (!claudeRes.ok) {
      throw new Error(`Erreur Claude API: ${claudeRes.status}`);
    }

    const claudeData = await claudeRes.json();
    const jsonString = claudeData.content[0].text;
    const workflow = JSON.parse(jsonString);

    // Validation des champs requis
    if (!workflow.name || !workflow.trigger_config || !workflow.action_key || !workflow.action_props) {
      throw new Error('Workflow généré invalide - champs manquants');
    }

    // Validation de l'action_key
    if (!ALLOWED_COMPONENTS.includes(workflow.action_key)) {
      throw new Error(`Action non autorisée: ${workflow.action_key}`);
    }

    const insert = await pool.query(
      'INSERT INTO workflows(user_id, name, trigger_config, action_key, action_props) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [request.user.userId, workflow.name, workflow.trigger_config, workflow.action_key, workflow.action_props]
    );

    logger.info({ workflow_id: insert.rows[0].id, user_id: request.user.userId }, 'Nouveau workflow créé');
    reply.code(201).send(insert.rows[0]);
  } catch (err) {
    logger.error({ error: err, user_id: request.user.userId }, 'Erreur création workflow depuis prompt');
    reply.code(500).send({ error: 'Impossible de générer le workflow.' });
  }
});

// Activer/désactiver un workflow
app.patch('/v1/workflows/:id', { preHandler: authenticateRequest }, async (request, reply) => {
  const { is_active } = request.body;
  
  try {
    const result = await pool.query(
      'UPDATE workflows SET is_active = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [is_active, request.params.id, request.user.userId]
    );
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Workflow non trouvé' });
    }
    
    reply.send(result.rows[0]);
  } catch (error) {
    logger.error({ error, workflow_id: request.params.id }, 'Erreur modification workflow');
    reply.code(500).send({ error: 'Erreur lors de la modification du workflow' });
  }
});

// Supprimer un workflow
app.delete('/v1/workflows/:id', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const result = await pool.query(
      'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING *',
      [request.params.id, request.user.userId]
    );
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Workflow non trouvé' });
    }
    
    reply.code(204).send();
  } catch (error) {
    logger.error({ error, workflow_id: request.params.id }, 'Erreur suppression workflow');
    reply.code(500).send({ error: 'Erreur lors de la suppression du workflow' });
  }
});

// ===== ROUTES DE LOGS =====

// Obtenir les logs d'exécution de l'utilisateur
app.get('/v1/logs', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT e.*, w.name as workflow_name 
       FROM executions e
       JOIN workflows w ON e.workflow_id = w.id
       WHERE w.user_id = $1
       ORDER BY e.started_at DESC 
       LIMIT 50`,
      [request.user.userId]
    );
    reply.send(result.rows);
  } catch (error) {
    logger.error({ error, user_id: request.user.userId }, 'Erreur récupération logs');
    reply.code(500).send({ error: 'Erreur lors de la récupération des logs' });
  }
});

// Obtenir les logs d'un workflow spécifique
app.get('/v1/workflows/:id/logs', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    // Vérifier que le workflow appartient à l'utilisateur
    const workflowCheck = await pool.query(
      'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    );
    
    if (workflowCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Workflow non trouvé' });
    }

    const result = await pool.query(
      'SELECT * FROM executions WHERE workflow_id = $1 ORDER BY started_at DESC LIMIT 20',
      [request.params.id]
    );
    reply.send(result.rows);
  } catch (error) {
    logger.error({ error, workflow_id: request.params.id }, 'Erreur récupération logs workflow');
    reply.code(500).send({ error: 'Erreur lors de la récupération des logs' });
  }
});

// ===== ROUTES D'ADMINISTRATION =====

// Créer un nouvel utilisateur (admin seulement)
app.post('/v1/admin/users', { 
  preHandler: [authenticateRequest, requireAdmin] 
}, async (request, reply) => {
  const { full_name, email, password, role } = request.body;
  
  if (!full_name || !email || !password || !role) {
    return reply.code(400).send({ error: 'Tous les champs sont requis' });
  }

  if (password.length < 8) {
    return reply.code(400).send({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  try {
    const result = await authManager.createUser({
      firstName: full_name.split(' ')[0],
      lastName: full_name.split(' ').slice(1).join(' ') || '',
      email,
      password,
      role
    });

    reply.code(201).send({
      message: 'Utilisateur créé avec succès',
      user: result.user
    });
  } catch (error) {
    logger.error({ error }, 'Erreur création utilisateur admin');
    reply.code(400).send({ error: error.message });
  }
});

// Lister tous les utilisateurs (admin seulement)
app.get('/v1/admin/users', { 
  preHandler: [authenticateRequest, requireAdmin] 
}, async (request, reply) => {
  try {
    const users = await authManager.listUsers(request.user.userId, request.user.role);
    reply.send(users);
  } catch (error) {
    logger.error({ error, admin_id: request.user.userId }, 'Erreur listage utilisateurs admin');
    reply.code(500).send({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// Mettre à jour un utilisateur (admin ou utilisateur lui-même)
app.patch('/v1/admin/users/:id', { preHandler: authenticateRequest }, async (request, reply) => {
  try {
    const updatedUser = await authManager.updateUser(
      parseInt(request.params.id),
      request.body,
      request.user.userId,
      request.user.role
    );
    reply.send(updatedUser);
  } catch (error) {
    logger.error({ error, target_user_id: request.params.id }, 'Erreur mise à jour utilisateur');
    reply.code(400).send({ error: error.message });
  }
});

// Statistiques système (admin seulement)
app.get('/v1/admin/stats', { 
  preHandler: [authenticateRequest, requireAdmin] 
}, async (request, reply) => {
  try {
    const [usersCount, workflowsCount, executionsCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM workflows'),
      pool.query('SELECT COUNT(*) FROM executions WHERE started_at > NOW() - INTERVAL \'24 hours\'')
    ]);

    reply.send({
      total_users: parseInt(usersCount.rows[0].count),
      total_workflows: parseInt(workflowsCount.rows[0].count),
      executions_24h: parseInt(executionsCount.rows[0].count)
    });
  } catch (error) {
    logger.error({ error }, 'Erreur récupération statistiques');
    reply.code(500).send({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Nettoyage périodique des sessions expirées
setInterval(async () => {
  await authManager.cleanupExpiredSessions();
}, 60 * 60 * 1000); // Toutes les heures

// Démarrer le serveur
async function start() {
  try {
    // Configuration d'écoute pour Railway
    const host = process.env.RAILWAY_STATIC_URL ? '0.0.0.0' : 'localhost';
    const port = config.port;
    
    await app.listen({ 
      port: port, 
      host: host 
    });
    
    logger.info({
      port: port,
      host: host,
      environment: config.nodeEnv,
      isRailway: config.isRailway
    }, `🚀 FlowForge v2.1 démarré avec succès`);
    
    // Log des informations importantes pour le debugging
    if (config.isRailway) {
      logger.info('🚂 Application déployée sur Railway');
      logger.info(`🔗 Health check disponible sur: /health`);
    }
    
  } catch (err) {
    logger.error({ error: err }, '❌ Erreur critique de démarrage du serveur');
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

