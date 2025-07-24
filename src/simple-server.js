import Fastify from 'fastify';

const app = Fastify({ logger: true });

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

// Route d'accueil
app.get('/', async () => {
  return {
    message: 'FlowForge v2.1 - AI Agent Platform',
    status: 'running',
    timestamp: new Date().toISOString()
  };
});

// Route de test
app.get('/test', async () => {
  return {
    test: 'OK',
    uptime: process.uptime(),
    memory: process.memoryUsage()
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