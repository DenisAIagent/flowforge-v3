import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'path';

const app = Fastify({ logger: true });

// Servir les fichiers statiques depuis /static au lieu de /
app.register(staticPlugin, {
  root: path.join(new URL('.', import.meta.url).pathname, '../public'),
  prefix: '/static/'
});

// Route favicon pour éviter l'erreur 404
app.get('/favicon.ico', async (request, reply) => {
  reply.redirect('/static/images/logo.png');
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
        
        /* Section d'authentification */
        .auth-section {
            background: #f8faff;
            padding: 3rem;
            border-radius: 25px;
            border: 2px solid #e0e7ff;
            margin: 3rem 0;
            box-shadow: 0 8px 25px rgba(30, 64, 175, 0.1);
        }
        
        .auth-form {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
        }
        
        .auth-buttons {
            display: flex;
            gap: 1.5rem;
            flex-wrap: wrap;
            justify-content: center;
        }
        
        .google-btn {
            display: flex;
            align-items: center;
            gap: 1rem;
            background: white;
            border: 2px solid #e5e7eb;
            padding: 1rem 2rem;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            color: #4b5563;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        .google-btn:hover {
            border-color: #1e40af;
            box-shadow: 0 6px 20px rgba(30, 64, 175, 0.2);
            transform: translateY(-2px);
        }
        
        .login-btn {
            background: #1e40af;
            color: white;
            border-color: #1e40af;
        }
        
        .login-btn:hover {
            background: #1d4ed8;
            border-color: #1d4ed8;
        }
        
        .request-btn {
            background: white;
            color: #4b5563;
            border-color: #e5e7eb;
        }
        
        .auth-message {
            padding: 1rem 2rem;
            border-radius: 15px;
            font-weight: 500;
            text-align: center;
            max-width: 400px;
        }
        
        .auth-message.success {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
        }
        
        .auth-message.error {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }
        
        .auth-message.info {
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #dbeafe;
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
        
        <!-- Section d'authentification -->
        <div class="auth-section">
            <h2 style="color: #1e40af; margin-bottom: 1rem;">Accès à FlowForge</h2>
            <p style="color: #6b7280; margin-bottom: 2rem;">Connectez-vous avec votre compte Google</p>
            
            <div class="auth-form">
                <div class="auth-buttons">
                    <button onclick="loginWithGoogle()" class="google-btn login-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Se connecter
                    </button>
                    
                    <button onclick="requestAccessWithGoogle()" class="google-btn request-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Demander l'accès
                    </button>
                </div>
                
                <p style="font-size: 0.9rem; color: #6b7280; margin-top: 1rem;">
                    Nouveau sur FlowForge ? Demandez l'accès et un administrateur examinera votre demande.
                </p>
                
                <div id="authMessage" class="auth-message" style="display: none;"></div>
            </div>
        </div>

        <div class="api-links">
            <a href="/v1" class="api-link">📋 Documentation API</a>
            <a href="/v1/agents" class="api-link">🤖 Agents API</a>
            <a href="/health" class="api-link">💚 Status Système</a>
            <a href="/test/db" class="api-link">🗄️ Test Base de Données</a>
            <a href="/admin/requests" class="api-link">🛡️ Admin Panel</a>
        </div>
        
        <div class="timestamp">
            Démarré le ${new Date().toLocaleString('fr-FR')} • Railway Europe West
        </div>
    </div>
    
    <script>
        // Connexion pour utilisateurs existants
        function loginWithGoogle() {
            const authMessage = document.getElementById('authMessage');
            authMessage.style.display = 'block';
            authMessage.className = 'auth-message info';
            authMessage.textContent = 'Connexion en cours...';
            
            // Rediriger vers notre endpoint de connexion
            window.location.href = '/auth/google/login';
        }
        
        // Demande d'accès pour nouveaux utilisateurs
        function requestAccessWithGoogle() {
            const authMessage = document.getElementById('authMessage');
            authMessage.style.display = 'block';
            authMessage.className = 'auth-message info';
            authMessage.textContent = 'Redirection vers Google...';
            
            // Rediriger vers notre endpoint de demande d'accès
            window.location.href = '/auth/google/request';
        }
        
        // Vérifier si on revient d'une tentative d'auth
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');
        const authMessage = document.getElementById('authMessage');
        
        if (authStatus && authMessage) {
            authMessage.style.display = 'block';
            const message = urlParams.get('message');
            
            switch(authStatus) {
                case 'pending':
                    authMessage.className = 'auth-message info';
                    authMessage.textContent = '✉️ Demande envoyee ! Un administrateur va examiner votre demande et vous recevrez un email de confirmation.';
                    break;
                case 'approved':
                    authMessage.className = 'auth-message success';
                    authMessage.textContent = '✅ Votre acces a ete approuve! Vous pouvez maintenant vous connecter.';
                    break;
                case 'rejected':
                    authMessage.className = 'auth-message error';
                    authMessage.textContent = '❌ Votre demande d\\'acces a ete refusee. Contactez l\\'administrateur pour plus d\\'informations.';
                    break;
                case 'logged_out':
                    authMessage.className = 'auth-message info';
                    authMessage.textContent = '👋 Vous avez ete deconnecte avec succes.';
                    break;
                case 'error':
                    authMessage.className = 'auth-message error';
                    
                    switch(message) {
                        case 'oauth_not_configured':
                            authMessage.innerHTML = '⚙️ <strong>Configuration requise:</strong><br/>• Configurez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET<br/>• Voir SETUP.md pour les instructions completes';
                            break;
                        case 'user_not_found':
                            authMessage.textContent = '🔍 Utilisateur non trouve. Demandez d\\'abord l\\'acces avec le bouton "Demander l\\'acces".';
                            break;
                        case 'account_inactive':
                            authMessage.textContent = '⏳ Votre compte n\\'est pas encore active. Contactez l\\'administrateur.';
                            break;
                        case 'session_expired':
                            authMessage.textContent = '⏰ Votre session a expire. Veuillez vous reconnecter.';
                            break;
                        case 'not_authenticated':
                            authMessage.textContent = '🔐 Acces non autorise. Veuillez vous connecter d\\'abord.';
                            break;
                        default:
                            authMessage.textContent = '⚠️ Erreur lors de l\\'authentification. Verifiez la configuration et reessayez.';
                    }
                    break;
            }
        }
    </script>
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

// ===== ROUTES D'AUTHENTIFICATION GOOGLE =====

// Connexion utilisateur existant
app.get('/auth/google/login', async (request, reply) => {
  try {
    // Vérifier si Google OAuth est configuré
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.log('⚠️  Google OAuth non configuré - variables GOOGLE_CLIENT_ID/SECRET manquantes');
      return reply.redirect('/?auth=error&message=oauth_not_configured');
    }
    
    const authUrl = authService.generateGoogleAuthUrl('login');
    console.log('🔐 Redirection vers Google OAuth pour connexion');
    reply.redirect(authUrl);
  } catch (error) {
    console.error('❌ Erreur génération URL auth:', error);
    reply.redirect('/?auth=error&message=oauth_error');
  }
});

// Demande d'accès pour nouvel utilisateur
app.get('/auth/google/request', async (request, reply) => {
  try {
    // Vérifier si Google OAuth est configuré
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.log('⚠️  Google OAuth non configuré - variables GOOGLE_CLIENT_ID/SECRET manquantes');
      return reply.redirect('/?auth=error&message=oauth_not_configured');
    }
    
    const authUrl = authService.generateGoogleAuthUrl('request');
    console.log('📧 Redirection vers Google OAuth pour demande d\'accès');
    reply.redirect(authUrl);
  } catch (error) {
    console.error('❌ Erreur génération URL auth:', error);
    reply.redirect('/?auth=error&message=oauth_error');
  }
});

// Callback OAuth Google
app.get('/auth/google/callback', async (request, reply) => {
  const { code, state } = request.query;
  
  if (!code) {
    return reply.redirect('/?auth=error&message=oauth_callback_error');
  }
  
  try {
    // Décoder le state pour savoir si c'est login ou request
    const stateData = JSON.parse(state || '{}');
    const authType = stateData.type || 'login';
    
    // Échanger le code contre les informations utilisateur
    const userInfo = await authService.exchangeCodeForTokens(code);
    
    if (authType === 'login') {
      // Connexion - vérifier si l'utilisateur existe et est approuvé
      const user = await authService.getUserByEmail(userInfo.email);
      
      if (!user) {
        return reply.redirect('/?auth=error&message=user_not_found');
      }
      
      if (user.status !== 'active') {
        return reply.redirect('/?auth=error&message=account_inactive');
      }
      
      // Créer session
      const sessionToken = await authService.createUserSession(user);
      request.session.sessionToken = sessionToken;
      request.session.user = {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role
      };
      
      reply.redirect('/dashboard');
      
    } else if (authType === 'request') {
      // Demande d'accès - créer une nouvelle demande
      const accessRequest = await authService.createAccessRequest(userInfo);
      reply.redirect('/?auth=pending');
    }
    
  } catch (error) {
    console.error('❌ Erreur callback OAuth:', error);
    reply.redirect('/?auth=error&message=callback_processing_error');
  }
});

// Route pour approuver une demande (lien dans l'email admin)
app.get('/admin/approve/:requestId', async (request, reply) => {
  const { requestId } = request.params;
  
  try {
    // TODO: Mettre à jour la demande en base
    // TODO: Créer le compte utilisateur 
    // TODO: Envoyer email de confirmation à l'utilisateur
    
    console.log(`✅ Demande ${requestId} approuvée`);
    
    reply.type('text/html').send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #10b981;">✅ Demande Approuvée</h1>
          <p>L'utilisateur a été notifié et peut maintenant accéder à FlowForge.</p>
          <a href="/" style="color: #1e40af;">Retour à l'accueil</a>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Erreur approbation:', error);
    reply.code(500).send({ error: 'Erreur lors de l\'approbation' });
  }
});

// Route pour refuser une demande (lien dans l'email admin)
app.get('/admin/reject/:requestId', async (request, reply) => {
  const { requestId } = request.params;
  
  try {
    // TODO: Mettre à jour la demande en base
    // TODO: Envoyer email de refus à l'utilisateur
    
    console.log(`❌ Demande ${requestId} refusée`);
    
    reply.type('text/html').send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #dc2626;">❌ Demande Refusée</h1>
          <p>L'utilisateur a été notifié du refus.</p>
          <a href="/" style="color: #1e40af;">Retour à l'accueil</a>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Erreur refus:', error);
    reply.code(500).send({ error: 'Erreur lors du refus' });
  }
});

// Route admin pour voir les demandes en attente
app.get('/admin/requests', async (request, reply) => {
  try {
    // TODO: Récupérer les demandes depuis la base de données
    const mockRequests = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        requested_at: '2025-07-24T20:30:00Z',
        status: 'pending'
      },
      {
        id: 2, 
        name: 'Jane Smith',
        email: 'jane@company.com',
        requested_at: '2025-07-24T19:15:00Z',
        status: 'pending'
      }
    ];
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Admin - Demandes d'accès</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .request { background: #f9f9f9; padding: 20px; margin: 10px 0; border-radius: 10px; }
            .approve { background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px; }
            .reject { background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style>
    </head>
    <body>
        <h1>🛡️ Demandes d'accès en attente</h1>
        ${mockRequests.map(req => `
            <div class="request">
                <h3>${req.name} (${req.email})</h3>
                <p>Demandé le: ${new Date(req.requested_at).toLocaleString('fr-FR')}</p>
                <a href="/admin/approve/${req.id}" class="approve">✅ Approuver</a>
                <a href="/admin/reject/${req.id}" class="reject">❌ Refuser</a>
            </div>
        `).join('')}
    </body>
    </html>`;
    
    reply.type('text/html').send(html);
    
  } catch (error) {
    console.error('Erreur récupération demandes:', error);
    reply.code(500).send({ error: 'Erreur lors de la récupération des demandes' });
  }
});

// ===== DASHBOARD (pour utilisateurs connectés) =====

app.get('/dashboard', async (request, reply) => {
  // Pour l'instant, dashboard simple
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>FlowForge - Dashboard</title>
      <style>
          body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; }
          .header { background: #1e40af; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
          .container { max-width: 1200px; margin: 2rem auto; padding: 0 2rem; }
          .welcome { background: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
          .feature-card { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .btn { background: #1e40af; color: white; padding: 0.8rem 1.5rem; border: none; border-radius: 5px; text-decoration: none; display: inline-block; }
          .logout { background: transparent; color: white; border: 1px solid white; }
      </style>
  </head>
  <body>
      <div class="header">
          <h1>🤖 FlowForge Dashboard</h1>
          <a href="/" class="btn logout">Déconnexion</a>
      </div>
      
      <div class="container">
          <div class="welcome">
              <h2>🎉 Bienvenue sur FlowForge !</h2>
              <p>Vous êtes maintenant connecté et pouvez créer vos agents IA.</p>
          </div>
          
          <div class="features">
              <div class="feature-card">
                  <h3>🤖 Mes Agents</h3>
                  <p>Créez et gérez vos agents IA intelligents</p>
                  <a href="/v1/agents" class="btn">Voir les agents</a>
              </div>
              
              <div class="feature-card">
                  <h3>💬 Assistant IA</h3>
                  <p>Chattez avec l'assistant pour créer des agents</p>
                  <a href="/chat" class="btn">Ouvrir Chat</a>
              </div>
              
              <div class="feature-card">
                  <h3>🔧 Intégrations</h3>
                  <p>Configurez vos services et APIs</p>
                  <a href="/integrations" class="btn">Configurer</a>
              </div>
              
              <div class="feature-card">
                  <h3>📊 Monitoring</h3>
                  <p>Surveillez vos agents en temps réel</p>
                  <a href="/monitoring" class="btn">Voir Stats</a>
              </div>
          </div>
      </div>
  </body>
  </html>`;
  
  reply.type('text/html').send(html);
});

// Route de déconnexion
app.get('/logout', async (request, reply) => {
  if (request.session) {
    request.session.destroy();
  }
  reply.redirect('/?auth=logged_out');
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