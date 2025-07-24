import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'path';
import fetch from 'node-fetch';

// Configuration et logging
import { config } from './config.js';
import { logger } from './utils/logger.js';

// Fonction principale d'initialisation de l'application
export async function createApp() {
  try {
    logger.info(`🚀 Initialisation FlowForge v2.1 [${config.nodeEnv}]`);
    
    // Imports dynamiques des modules
    const [
      { default: pool },
      { authManager },
      { integrationsManager },
      { chatManager },
      { agentManager },
      { decrypt, encrypt }
    ] = await Promise.all([
      import('./db/pool.js'),
      import('./auth.js'),
      import('./integrations.js'),
      import('./chat.js'),
      import('./agent-manager.js'),
      import('./crypto.js')
    ]);
    
    logger.info('✅ Tous les modules importés avec succès');
    
    const app = Fastify({ logger: false }); // Désactiver le logger Fastify pour éviter les conflits
    
    // Middleware d'authentification
    async function authenticateRequest(request, reply) {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Token d\\'authentification requis' });
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
    
    // Configuration CORS
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
    
    // Route de santé
    app.get('/health', async (request, reply) => {
      try {
        const dbTest = await pool.query('SELECT NOW() as current_time');
        
        reply.code(200).send({
          status: 'ok',
          service: 'FlowForge v2.1 - AI Agent Platform',
          timestamp: new Date().toISOString(),
          version: '2.1.0',
          environment: config.nodeEnv,
          database: {
            connected: true,
            timestamp: dbTest.rows[0]?.current_time
          },
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          isRailway: config.isRailway
        });
      } catch (error) {
        logger.error({ error }, 'Health check failed');
        reply.code(503).send({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Routes d'authentification
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
    
    // Route simple pour tester le démarrage
    app.get('/', async () => ({ 
      message: 'FlowForge v2.1 - AI Agent Platform',
      status: 'running',
      version: '2.1.0'
    }));
    
    logger.info('✅ Application Fastify configurée');
    return app;
    
  } catch (error) {
    logger.error({ error }, '❌ Erreur critique lors de la création de l\'application');
    throw error;
  }
}