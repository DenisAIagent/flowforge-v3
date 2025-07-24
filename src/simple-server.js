import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'path';

const app = Fastify({ logger: true });

// Servir les fichiers statiques depuis /static au lieu de /
app.register(staticPlugin, {
  root: path.join(new URL('.', import.meta.url).pathname, '../public'),
  prefix: '/static/'
});

// Route de santé simple
app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'FlowForge v2.1',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000
  };
});

// Route d'accueil avec HTML - Fond blanc, texte bleu, logo en gros
app.get('/', async (request, reply) => {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FlowForge v2.1 - AI Agent Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #1e40af;
        }
        .container {
            text-align: center;
            max-width: 1000px;
            padding: 3rem;
        }
        .logo {
            width: 200px;
            height: auto;
            margin-bottom: 2rem;
            filter: brightness(0) saturate(100%) invert(21%) sepia(96%) saturate(2131%) hue-rotate(220deg) brightness(91%) contrast(91%);
        }
        h1 { 
            font-size: 4rem; 
            margin-bottom: 1rem; 
            font-weight: 700; 
            color: #1e40af;
            text-shadow: 0 2px 4px rgba(30, 64, 175, 0.1);
        }
        .subtitle { 
            font-size: 1.5rem; 
            margin-bottom: 3rem; 
            color: #3b82f6;
            font-weight: 400;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin: 3rem 0;
        }
        .feature {
            background: #f8faff;
            padding: 2rem;
            border-radius: 20px;
            border: 2px solid #e0e7ff;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(30, 64, 175, 0.1);
        }
        .feature:hover {
            transform: translateY(-5px);
            border-color: #3b82f6;
            box-shadow: 0 8px 25px rgba(30, 64, 175, 0.15);
        }
        .feature h3 { 
            margin-bottom: 1rem; 
            color: #1e40af;
            font-size: 1.3rem;
        }
        .feature p {
            color: #4338ca;
            line-height: 1.6;
        }
        .api-links {
            display: flex;
            gap: 1.5rem;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 3rem;
        }
        .api-link {
            background: #1e40af;
            color: white;
            text-decoration: none;
            padding: 1rem 2rem;
            border-radius: 30px;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(30, 64, 175, 0.3);
        }
        .api-link:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(30, 64, 175, 0.4);
        }
        .status {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 0.8rem 1.5rem;
            border-radius: 25px;
            font-size: 1rem;
            font-weight: 600;
            margin: 2rem 0;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }
        .timestamp {
            color: #6b7280;
            font-size: 1rem;
            margin-top: 2rem;
            font-weight: 400;
        }
        
        @media (max-width: 768px) {
            .container { padding: 2rem 1rem; }
            h1 { font-size: 2.5rem; }
            .subtitle { font-size: 1.2rem; }
            .logo { width: 150px; }
            .features { grid-template-columns: 1fr; gap: 1.5rem; }
            .api-links { flex-direction: column; align-items: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="/static/images/logo.png" alt="FlowForge Logo" class="logo">
        
        <h1>FlowForge v2.1</h1>
        <p class="subtitle">Plateforme d'Agents IA - Comme String.com</p>
        
        <div class="status">✅ Système Opérationnel</div>
        
        <div class="features">
            <div class="feature">
                <h3>🧠 Agents IA Intelligents</h3>
                <p>Créez des agents autonomes qui comprennent et automatisent vos tâches complexes avec l'intelligence artificielle</p>
            </div>
            <div class="feature">
                <h3>⚡ Déploiement Instantané</h3>
                <p>Déployez vos agents en quelques secondes et voyez-les s'exécuter immédiatement dans le cloud</p>
            </div>
            <div class="feature">
                <h3>📊 Monitoring Avancé</h3>
                <p>Surveillez les performances, logs et métriques de tous vos agents en temps réel</p>
            </div>
            <div class="feature">
                <h3>🔗 Intégrations Multiples</h3>
                <p>Connectez Gmail, Slack, Discord, GitHub, Google Sheets et bien plus encore</p>
            </div>
        </div>
        
        <div class="api-links">
            <a href="/v1" class="api-link">📋 Documentation API</a>
            <a href="/v1/agents" class="api-link">🤖 Agents API</a>
            <a href="/health" class="api-link">💚 Status Système</a>
            <a href="/test/db" class="api-link">🗄️ Test Base de Données</a>
        </div>
        
        <div class="timestamp">
            Démarré le ${new Date().toLocaleString('fr-FR')} • Railway Europe West
        </div>
    </div>
</body>
</html>`;

  reply.type('text/html').send(html);
});

// Route de test
app.get('/test', async () => {
  return {
    test: 'OK',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
});

// Route de test avec base de données (optionnelle)
app.get('/test/db', async () => {
  try {
    // Test de connexion DB seulement si DATABASE_URL est définie
    if (process.env.DATABASE_URL) {
      const { default: pg } = await import('pg');
      const { Pool } = pg;
      const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
      await pool.end();
      
      return {
        database: 'connected',
        timestamp: result.rows[0].current_time,
        postgresql_version: result.rows[0].pg_version,
        connection_string: process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@') // Masque le mot de passe
      };
    } else {
      return {
        database: 'not_configured',
        message: 'DATABASE_URL environment variable not set'
      };
    }
  } catch (error) {
    return {
      database: 'connection_failed',
      error: error.message,
      code: error.code
    };
  }
});

// Routes pour les agents IA (version simple)
app.get('/v1/agents', async () => {
  return {
    message: 'FlowForge AI Agents API',
    version: '2.1.0',
    agents: [],
    status: 'ready',
    note: 'Database connection required for full functionality'
  };
});

app.post('/v1/agents', async (request, reply) => {
  const { name, description, type } = request.body || {};
  
  if (!name || !description) {
    return reply.code(400).send({
      error: 'Name and description are required',
      required_fields: ['name', 'description'],
      optional_fields: ['type']
    });
  }
  
  // Pour l'instant, on retourne juste les données reçues
  return {
    message: 'Agent creation endpoint ready',
    received_data: {
      name,
      description,
      type: type || 'autonomous'
    },
    status: 'pending_database_setup',
    note: 'Agent will be created once database is configured'
  };
});

// Route d'information sur l'API
app.get('/v1', async () => {
  return {
    service: 'FlowForge v2.1 - AI Agent Platform',
    version: '2.1.0',
    description: 'Create and deploy AI agents like String.com',
    endpoints: {
      health: '/health',
      agents: '/v1/agents',
      test: '/test',
      database_test: '/test/db'
    },
    features: [
      'AI Agent Creation',
      'Real-time Agent Deployment', 
      'Agent Monitoring',
      'Multi-service Integration'
    ],
    status: 'operational'
  };
});

async function start() {
  try {
    const port = parseInt(process.env.PORT) || 3000;
    const host = '0.0.0.0';
    
    console.log(`🚀 Starting FlowForge v2.1 on ${host}:${port}`);
    
    await app.listen({ 
      port: port, 
      host: host 
    });
    
    console.log(`✅ FlowForge v2.1 started successfully!`);
    console.log(`🔗 Health check available at: /health`);
    
  } catch (err) {
    console.error('❌ Server startup failed:', err);
    process.exit(1);
  }
}

// Gestion des signaux
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT received, shutting down gracefully');
  process.exit(0);
});

start();