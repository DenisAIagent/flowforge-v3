// FlowForge - Application complète avec gestion utilisateurs et intégrations
let currentUser = null;
let sessionToken = localStorage.getItem('flowforge_session');
let currentConversation = null;
let currentSessionId = null;

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier la session
    if (sessionToken) {
        const isValid = await validateSession();
        if (isValid) {
            showMainApp();
            return;
        }
    }
    
    showLoginPage();
});

// ===== AUTHENTIFICATION =====
async function validateSession() {
    try {
        const response = await fetch('/v1/auth/validate', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            return true;
        }
    } catch (error) {
        console.error('Erreur validation session:', error);
    }

    localStorage.removeItem('flowforge_session');
    sessionToken = null;
    return false;
}

async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            sessionToken = data.sessionToken;
            localStorage.setItem('flowforge_session', sessionToken);
            currentUser = data.user;
            showMainApp();
        } else {
            showNotification(data.error || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        showNotification('Erreur de connexion au serveur', 'error');
    }
}

async function register(event) {
    event.preventDefault();
    
    const firstName = document.getElementById('registerFirstName').value;
    const lastName = document.getElementById('registerLastName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch('/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Compte créé avec succès ! Vous pouvez maintenant vous connecter.', 'success');
            showLoginPage();
        } else {
            showNotification(data.error || 'Erreur lors de la création du compte', 'error');
        }
    } catch (error) {
        showNotification('Erreur de connexion au serveur', 'error');
    }
}

function logout() {
    localStorage.removeItem('flowforge_session');
    sessionToken = null;
    currentUser = null;
    currentConversation = null;
    showLoginPage();
}

// ===== NAVIGATION =====
function showLoginPage() {
    document.body.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-header">
                    <img src="images/logo.png" alt="FlowForge" class="auth-logo">
                    <h1>Connexion</h1>
                    <p>Accédez à votre espace d'automatisation</p>
                </div>
                
                <form onsubmit="login(event)" class="auth-form">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="loginEmail" required>
                    </div>
                    <div class="form-group">
                        <label>Mot de passe</label>
                        <input type="password" id="loginPassword" required>
                    </div>
                    <button type="submit" class="btn-primary full-width">Se connecter</button>
                </form>
                
                <div class="auth-footer">
                    <p>Pas de compte ? <a href="#" onclick="showRegisterPage()">S'inscrire</a></p>
                </div>
            </div>
        </div>
    `;
}

function showRegisterPage() {
    document.body.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-header">
                    <img src="images/logo.png" alt="FlowForge" class="auth-logo">
                    <h1>Inscription</h1>
                    <p>Créez votre compte FlowForge</p>
                </div>
                
                <form onsubmit="register(event)" class="auth-form">
                    <div class="form-group">
                        <label>Prénom</label>
                        <input type="text" id="registerFirstName" required>
                    </div>
                    <div class="form-group">
                        <label>Nom</label>
                        <input type="text" id="registerLastName" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="registerEmail" required>
                    </div>
                    <div class="form-group">
                        <label>Mot de passe</label>
                        <input type="password" id="registerPassword" required minlength="6">
                    </div>
                    <button type="submit" class="btn-primary full-width">Créer le compte</button>
                </form>
                
                <div class="auth-footer">
                    <p>Déjà un compte ? <a href="#" onclick="showLoginPage()">Se connecter</a></p>
                </div>
            </div>
        </div>
    `;
}

function showMainApp() {
    document.body.innerHTML = `
        <div class="app-container">
            <!-- Sidebar Navigation -->
            <nav class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <img src="images/logo.png" alt="FlowForge" class="logo">
                    <div class="user-info" id="user-info">
                        <span class="user-name" id="user-name"></span>
                        <span class="user-role" id="user-role"></span>
                    </div>
                </div>
                
                <ul class="nav-menu">
                    <li><a href="#dashboard" onclick="showPage('dashboard')" class="nav-link active">
                        <span class="icon">🏠</span>Dashboard
                    </a></li>
                    
                    <li><a href="#workflows" onclick="showPage('workflows')" class="nav-link">
                        <span class="icon">⚡</span>Workflows
                    </a></li>
                    
                    <li><a href="#chat" onclick="showPage('chat')" class="nav-link">
                        <span class="icon">💬</span>Assistant IA
                    </a></li>
                    
                    <li><a href="#integrations" onclick="showPage('integrations')" class="nav-link">
                        <span class="icon">🔗</span>Intégrations
                    </a></li>
                    
                    <li><a href="#users" onclick="showPage('users')" class="nav-link admin-only">
                        <span class="icon">👥</span>Utilisateurs
                    </a></li>
                    
                    <li><a href="#settings" onclick="showPage('settings')" class="nav-link">
                        <span class="icon">⚙️</span>Paramètres
                    </a></li>
                </ul>
                
                <div class="sidebar-footer">
                    <button onclick="logout()" class="logout-btn">
                        <span class="icon">🚪</span>Déconnexion
                    </button>
                </div>
            </nav>

            <!-- Main Content -->
            <main class="main-content">
                <!-- Page Dashboard -->
                <div id="dashboard-page" class="page-content">
                    <div class="page-header">
                        <h1>🏠 Dashboard</h1>
                    </div>
                    <div class="dashboard-stats">
                        <div class="stat-card">
                            <h3 id="workflows-count">0</h3>
                            <p>Workflows Actifs</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="integrations-count">0</h3>
                            <p>Intégrations</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="executions-count">0</h3>
                            <p>Exécutions Aujourd'hui</p>
                        </div>
                    </div>
                </div>

                <!-- Page Utilisateurs -->
                <div id="users-page" class="page-content" style="display: none;">
                    <div class="page-header">
                        <h1>👥 Gestion des Utilisateurs</h1>
                        <button onclick="showAddUserModal()" class="btn-primary">
                            <span class="icon">➕</span>Nouvel Utilisateur
                        </button>
                    </div>

                    <div class="users-stats">
                        <div class="stat-card">
                            <h3 id="total-users">0</h3>
                            <p>Utilisateurs Total</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="active-users">0</h3>
                            <p>Actifs</p>
                        </div>
                        <div class="stat-card">
                            <h3 id="admin-users">0</h3>
                            <p>Administrateurs</p>
                        </div>
                    </div>

                    <div class="users-table-container">
                        <table class="users-table" id="users-table">
                            <thead>
                                <tr>
                                    <th>Utilisateur</th>
                                    <th>Email</th>
                                    <th>Rôle</th>
                                    <th>Statut</th>
                                    <th>Dernière Connexion</th>
                                    <th>Workflows</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="users-table-body">
                                <tr><td colspan="7" class="loading">Chargement...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Page Intégrations -->
                <div id="integrations-page" class="page-content" style="display: none;">
                    <div class="page-header">
                        <h1>🔗 Intégrations</h1>
                        <div class="integrations-actions">
                            <button onclick="refreshIntegrations()" class="btn-secondary">
                                <span class="icon">🔄</span>Actualiser
                            </button>
                        </div>
                    </div>

                    <div class="integrations-categories" id="integrations-categories">
                        <!-- Contenu généré dynamiquement -->
                    </div>
                </div>

                <!-- Page Chat -->
                <div id="chat-page" class="page-content" style="display: none;">
                    <div class="page-header">
                        <h1>💬 Assistant IA</h1>
                        <button onclick="startNewConversation()" class="btn-secondary">
                            <span class="icon">🔄</span>Nouvelle Conversation
                        </button>
                    </div>

                    <div class="chat-container">
                        <div class="chat-messages" id="chat-messages">
                            <!-- Messages du chat -->
                        </div>
                        <form onsubmit="sendChatMessage(event)" class="chat-form">
                            <div class="chat-input-container">
                                <textarea id="chat-input" placeholder="Décrivez ce que vous voulez automatiser..." rows="1"></textarea>
                                <button type="submit" class="btn-primary">
                                    <span class="icon">📤</span>Envoyer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Page Workflows -->
                <div id="workflows-page" class="page-content" style="display: none;">
                    <div class="page-header">
                        <h1>⚡ Workflows</h1>
                    </div>
                    <div id="workflows-list">
                        <p class="loading">Chargement des workflows...</p>
                    </div>
                </div>

                <!-- Page Settings -->
                <div id="settings-page" class="page-content" style="display: none;">
                    <div class="page-header">
                        <h1>⚙️ Paramètres</h1>
                    </div>
                    <div class="settings-content">
                        <h3>Profil Utilisateur</h3>
                        <div class="form-group">
                            <label>Nom complet</label>
                            <input type="text" id="user-full-name" readonly>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="user-email" readonly>
                        </div>
                        <div class="form-group">
                            <label>Rôle</label>
                            <input type="text" id="user-role-display" readonly>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- Modal Overlay -->
        <div id="modal-overlay" class="modal-overlay" style="display: none;"></div>
        
        <!-- Modal Ajout Utilisateur -->
        <div id="add-user-modal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>👤 Nouvel Utilisateur</h3>
                    <button onclick="closeModal('add-user-modal')" class="modal-close">&times;</button>
                </div>
                <form id="add-user-form" onsubmit="createUser(event)">
                    <div class="form-group">
                        <label>Nom complet</label>
                        <input type="text" name="full_name" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label>Mot de passe</label>
                        <input type="password" name="password" required minlength="8">
                    </div>
                    <div class="form-group">
                        <label>Rôle</label>
                        <select name="role" required>
                            <option value="user">Utilisateur</option>
                            <option value="admin">Administrateur</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="closeModal('add-user-modal')" class="btn-secondary">Annuler</button>
                        <button type="submit" class="btn-primary">Créer</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Modal Configuration Intégration -->
        <div id="integration-modal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="integration-modal-title">Configuration</h3>
                    <button onclick="closeModal('integration-modal')" class="modal-close">&times;</button>
                </div>
                <div id="integration-modal-body">
                    <!-- Contenu dynamique -->
                </div>
            </div>
        </div>
    `;

    updateUserInfo();
    initMainApp();
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('user-name').textContent = 
            `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Utilisateur';
        document.getElementById('user-role').textContent = currentUser.role || 'user';
        
        // Afficher/masquer les éléments admin
        if (currentUser.role === 'admin') {
            document.body.classList.add('admin');
        }

        // Remplir les paramètres
        const fullNameInput = document.getElementById('user-full-name');
        const emailInput = document.getElementById('user-email');
        const roleInput = document.getElementById('user-role-display');
        
        if (fullNameInput) fullNameInput.value = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
        if (emailInput) emailInput.value = currentUser.email || '';
        if (roleInput) roleInput.value = currentUser.role || '';
    }
}

async function initMainApp() {
    await loadDashboardStats();
    await startChatConversation();
    showPage('dashboard');
}

// ===== NAVIGATION ENTRE PAGES =====
function showPage(pageId) {
    // Mettre à jour la navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`[onclick="showPage('${pageId}')"]`);
    if (activeLink) activeLink.classList.add('active');

    // Masquer toutes les pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.style.display = 'none';
    });
    
    // Afficher la page demandée
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }

    // Charger les données spécifiques à la page
    loadPageData(pageId);
}

async function loadPageData(pageId) {
    switch (pageId) {
        case 'dashboard':
            await loadDashboardStats();
            break;
        case 'users':
            if (currentUser?.role === 'admin') {
                await loadUsersPage();
            }
            break;
        case 'integrations':
            await loadIntegrationsPage();
            break;
        case 'chat':
            if (!currentConversation) {
                await startChatConversation();
            }
            break;
        case 'workflows':
            await loadWorkflowsPage();
            break;
    }
}

// ===== DASHBOARD =====
async function loadDashboardStats() {
    try {
        const [workflowsRes, integrationsRes] = await Promise.all([
            fetch('/v1/workflows', { headers: getAuthHeaders() }),
            fetch('/v1/integrations', { headers: getAuthHeaders() })
        ]);

        if (workflowsRes.ok && integrationsRes.ok) {
            const workflows = await workflowsRes.json();
            const integrations = await integrationsRes.json();

            document.getElementById('workflows-count').textContent = 
                workflows.filter(w => w.is_active).length;
            document.getElementById('integrations-count').textContent = 
                integrations.filter(i => i.status === 'active').length;
            document.getElementById('executions-count').textContent = '0'; // TODO: Implémenter
        }
    } catch (error) {
        console.error('Erreur chargement stats dashboard:', error);
    }
}

// ===== GESTION DES UTILISATEURS =====
async function loadUsersPage() {
    try {
        const response = await fetch('/v1/admin/users', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Erreur chargement utilisateurs');
        
        const users = await response.json();
        displayUsers(users);
        updateUsersStats(users);
        
    } catch (error) {
        showNotification('Erreur lors du chargement des utilisateurs', 'error');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${(user.first_name?.[0] || '') + (user.last_name?.[0] || '')}</div>
                    <div class="user-info">
                        <strong>${user.first_name} ${user.last_name}</strong>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="role-badge ${user.role}">${user.role}</span>
            </td>
            <td>
                <span class="status-badge ${user.status || 'active'}">${user.status || 'active'}</span>
            </td>
            <td>${user.last_login ? formatDate(user.last_login) : 'Jamais'}</td>
            <td>${user.workflow_count || 0}</td>
            <td>
                <div class="table-actions">
                    <button onclick="editUser(${user.id})" class="btn-icon" title="Modifier">✏️</button>
                    <button onclick="toggleUserStatus(${user.id})" class="btn-icon" title="Activer/Désactiver">🔄</button>
                    <button onclick="deleteUser(${user.id})" class="btn-icon danger" title="Supprimer">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateUsersStats(users) {
    document.getElementById('total-users').textContent = users.length;
    document.getElementById('active-users').textContent = users.filter(u => (u.status || 'active') === 'active').length;
    document.getElementById('admin-users').textContent = users.filter(u => u.role === 'admin').length;
}

function showAddUserModal() {
    showModal('add-user-modal');
}

async function createUser(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const userData = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch('/v1/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            showNotification('Utilisateur créé avec succès', 'success');
            closeModal('add-user-modal');
            loadUsersPage();
        } else {
            const error = await response.json();
            showNotification(error.message, 'error');
        }
        
    } catch (error) {
        showNotification('Erreur lors de la création', 'error');
    }
}

// ===== GESTION DES INTÉGRATIONS =====
const SUPPORTED_SERVICES = {
    claude: {
        name: 'Claude (Anthropic)',
        type: 'api_key',
        category: 'ai',
        icon: '🤖'
    },
    google: {
        name: 'Google APIs',
        type: 'oauth2',
        category: 'productivity',
        icon: '📊'
    },
    brevo: {
        name: 'Brevo (ex-Sendinblue)',
        type: 'api_key',
        category: 'email',
        icon: '📧'
    },
    discord: {
        name: 'Discord',
        type: 'webhook',
        category: 'communication',
        icon: '🎮'
    },
    slack: {
        name: 'Slack',
        type: 'oauth2',
        category: 'communication',
        icon: '💬'
    },
    github: {
        name: 'GitHub',
        type: 'api_key',
        category: 'development',
        icon: '🐙'
    }
};

async function loadIntegrationsPage() {
    try {
        const response = await fetch('/v1/integrations', {
            headers: getAuthHeaders()
        });
        
        const integrations = await response.json();
        displayIntegrations(integrations);
        
    } catch (error) {
        showNotification('Erreur chargement intégrations', 'error');
    }
}

function displayIntegrations(integrations) {
    const container = document.getElementById('integrations-categories');
    const integrationsMap = {};
    
    integrations.forEach(int => {
        integrationsMap[int.service_name] = int;
    });

    const categories = {
        'ai': { name: '🤖 Intelligence Artificielle', services: ['claude'] },
        'productivity': { name: '📊 Productivité', services: ['google'] },
        'email': { name: '📧 Email Marketing', services: ['brevo'] },
        'communication': { name: '💬 Communication', services: ['discord', 'slack'] },
        'development': { name: '⚙️ Développement', services: ['github'] }
    };

    container.innerHTML = Object.entries(categories).map(([categoryKey, category]) => `
        <div class="integration-category">
            <h2>${category.name}</h2>
            <div class="integrations-grid">
                ${category.services.map(serviceName => {
                    const service = SUPPORTED_SERVICES[serviceName];
                    const integration = integrationsMap[serviceName];
                    const isConnected = integration && integration.status === 'active';
                    
                    return `
                        <div class="integration-card ${isConnected ? 'connected' : ''}" id="${serviceName}-card">
                            <div class="integration-header">
                                <div class="integration-icon">${service.icon}</div>
                                <div class="integration-info">
                                    <h3>${service.name}</h3>
                                    <p>${service.category}</p>
                                </div>
                            </div>
                            <div class="integration-status" id="${serviceName}-status">
                                <span class="status-indicator ${isConnected ? 'connected' : 'disconnected'}">●</span>
                                <span class="status-text">${isConnected ? 'Connecté' : 'Non configuré'}</span>
                            </div>
                            <div class="integration-actions">
                                <button onclick="configureIntegration('${serviceName}')" class="btn-configure">
                                    ${isConnected ? 'Reconfigurer' : 'Configurer'}
                                </button>
                                ${isConnected ? `
                                    <button onclick="testIntegration('${serviceName}', ${integration.id})" class="btn-test">Tester</button>
                                    ${serviceName === 'google' && !integration.access_token ? `
                                        <button onclick="connectGmail()" class="btn-connect">Se connecter</button>
                                    ` : ''}
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

async function configureIntegration(serviceName) {
    const service = SUPPORTED_SERVICES[serviceName];
    if (!service) return;
    
    const modalTitle = document.getElementById('integration-modal-title');
    const modalBody = document.getElementById('integration-modal-body');
    
    modalTitle.textContent = `Configuration ${service.name}`;
    modalBody.innerHTML = generateIntegrationForm(serviceName, service);
    
    showModal('integration-modal');
}

function generateIntegrationForm(serviceName, service) {
    const forms = {
        claude: `
            <div class="integration-form">
                <div class="integration-description">
                    <p>🤖 Claude est votre assistant IA pour créer des workflows intelligents.</p>
                    <p><strong>Obtenir votre clé :</strong> <a href="https://console.anthropic.com" target="_blank">Console Anthropic</a></p>
                </div>
                <form onsubmit="saveIntegration(event, 'claude')">
                    <div class="form-group">
                        <label>Clé API Anthropic</label>
                        <input type="password" name="api_key" required placeholder="sk-ant-...">
                        <small>Votre clé API Claude pour l'assistant conversationnel</small>
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="closeModal('integration-modal')" class="btn-secondary">Annuler</button>
                        <button type="submit" class="btn-primary">💾 Sauvegarder et Tester</button>
                    </div>
                </form>
            </div>
        `,
        
        google: `
            <div class="integration-form">
                <div class="integration-description">
                    <p>📊 Connectez Google APIs pour Gmail, Sheets et Drive.</p>
                    <div class="setup-steps">
                        <h4>🔧 Configuration Google Cloud:</h4>
                        <ol>
                            <li>Allez sur <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a></li>
                            <li>Créez un projet ou sélectionnez un existant</li>
                            <li>Activez Gmail API et Google Sheets API</li>
                            <li>Créez des identifiants OAuth 2.0</li>
                            <li>Ajoutez votre domaine aux origines autorisées</li>
                        </ol>
                    </div>
                </div>
                <form onsubmit="saveIntegration(event, 'google')">
                    <div class="form-group">
                        <label>Client ID</label>
                        <input type="text" name="client_id" required placeholder="xxx.apps.googleusercontent.com">
                    </div>
                    <div class="form-group">
                        <label>Client Secret</label>
                        <input type="password" name="client_secret" required>
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="closeModal('integration-modal')" class="btn-secondary">Annuler</button>
                        <button type="submit" class="btn-primary">💾 Sauvegarder</button>
                    </div>
                </form>
            </div>
        `,
        
        brevo: `
            <div class="integration-form">
                <div class="integration-description">
                    <p>📧 Brevo pour l'email marketing et les campagnes automatisées.</p>
                    <p><strong>Obtenir votre clé :</strong> Brevo → Paramètres → Clés API</p>
                </div>
                <form onsubmit="saveIntegration(event, 'brevo')">
                    <div class="form-group">
                        <label>Clé API Brevo</label>
                        <input type="password" name="api_key" required placeholder="xkeysib-...">
                        <small>Votre clé API pour l'envoi d'emails et gestion des contacts</small>
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="closeModal('integration-modal')" class="btn-secondary">Annuler</button>
                        <button type="submit" class="btn-primary">💾 Sauvegarder et Tester</button>
                    </div>
                </form>
            </div>
        `,
        
        discord: `
            <div class="integration-form">
                <div class="integration-description">
                    <p>🎮 Discord pour les notifications et alertes.</p>
                    <div class="setup-steps">
                        <h4>🔧 Créer un Webhook Discord:</h4>
                        <ol>
                            <li>Allez dans les paramètres de votre serveur Discord</li>
                            <li>Intégrations → Webhooks</li>
                            <li>Créer un webhook</li>
                            <li>Copier l'URL du webhook</li>
                        </ol>
                    </div>
                </div>
                <form onsubmit="saveIntegration(event, 'discord')">
                    <div class="form-group">
                        <label>URL du Webhook</label>
                        <input type="url" name="webhook_url" required placeholder="https://discord.com/api/webhooks/...">
                    </div>
                    <div class="form-group">
                        <label>Token Bot (optionnel)</label>
                        <input type="password" name="bot_token" placeholder="Pour fonctionnalités avancées">
                        <small>Requis uniquement pour les bots Discord avancés</small>
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="closeModal('integration-modal')" class="btn-secondary">Annuler</button>
                        <button type="submit" class="btn-primary">💾 Sauvegarder et Tester</button>
                    </div>
                </form>
            </div>
        `,
        
        github: `
            <div class="integration-form">
                <div class="integration-description">
                    <p>🐙 GitHub pour la gestion des issues et repositories.</p>
                    <div class="setup-steps">
                        <h4>🔧 Créer un Personal Access Token:</h4>
                        <ol>
                            <li>GitHub → Settings → Developer settings</li>
                            <li>Personal access tokens → Tokens (classic)</li>
                            <li>Generate new token</li>
                            <li>Sélectionner les scopes: repo, write:repo_hook</li>
                        </ol>
                    </div>
                </div>
                <form onsubmit="saveIntegration(event, 'github')">
                    <div class="form-group">
                        <label>Personal Access Token</label>
                        <input type="password" name="token" required placeholder="ghp_...">
                        <small>Token avec permissions repo et write:repo_hook</small>
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="closeModal('integration-modal')" class="btn-secondary">Annuler</button>
                        <button type="submit" class="btn-primary">💾 Sauvegarder et Tester</button>
                    </div>
                </form>
            </div>
        `
    };
    
    return forms[serviceName] || `<p>Configuration pour ${service.name} non disponible.</p>`;
}

async function saveIntegration(event, serviceName) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const credentials = Object.fromEntries(formData.entries());
    
    const integrationData = {
        serviceKey: serviceName,
        displayName: `${serviceName} - ${new Date().toLocaleDateString()}`,
        credentials,
        config: {}
    };
    
    try {
        const response = await fetch('/v1/integrations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(integrationData)
        });
        
        if (response.ok) {
            const integration = await response.json();
            
            // Tester automatiquement (sauf pour Google qui nécessite OAuth)
            if (serviceName !== 'google') {
                const testResult = await testIntegration(serviceName, integration.id);
                if (testResult.success) {
                    showNotification(`✅ ${serviceName} configuré et testé avec succès!`, 'success');
                } else {
                    showNotification(`⚠️ ${serviceName} configuré mais test échoué: ${testResult.error}`, 'warning');
                }
            } else {
                showNotification(`✅ ${serviceName} configuré! Cliquez sur "Se connecter" pour l'OAuth.`, 'success');
            }
            
            closeModal('integration-modal');
            loadIntegrationsPage();
            
        } else {
            const error = await response.json();
            showNotification(`❌ Erreur: ${error.message}`, 'error');
        }
        
    } catch (error) {
        showNotification(`❌ Erreur lors de la sauvegarde: ${error.message}`, 'error');
    }
}

async function testIntegration(serviceName, integrationId) {
    try {
        const response = await fetch(`/v1/integrations/${integrationId}/test`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`✅ Test ${serviceName} réussi: ${result.message}`, 'success');
        } else {
            showNotification(`❌ Test ${serviceName} échoué: ${result.error}`, 'error');
        }
        
        // Rafraîchir le statut
        loadIntegrationsPage();
        
        return result;
        
    } catch (error) {
        showNotification(`❌ Erreur test ${serviceName}: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

// OAuth Gmail spécifique
async function connectGmail() {
    try {
        // Récupérer les paramètres OAuth configurés
        const response = await fetch('/v1/integrations/google/oauth-url', {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const { authUrl } = await response.json();
            
            // Ouvrir la popup OAuth
            const popup = window.open(authUrl, 'gmail-oauth', 'width=500,height=600');
            
            // Écouter le retour OAuth
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    // Rafraîchir le statut des intégrations
                    setTimeout(() => loadIntegrationsPage(), 1000);
                }
            }, 1000);
            
        } else {
            showNotification('❌ Erreur configuration OAuth Google', 'error');
        }
        
    } catch (error) {
        showNotification(`❌ Erreur connexion Gmail: ${error.message}`, 'error');
    }
}

function refreshIntegrations() {
    loadIntegrationsPage();
}

// ===== CHAT =====
async function startChatConversation() {
    try {
        const response = await fetch('/v1/chat/start', {
            method: 'POST',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            currentConversation = data.conversation;
            currentSessionId = data.conversation.session_id;
            await loadChatMessages();
        }
    } catch (error) {
        console.error('Erreur démarrage conversation:', error);
    }
}

async function loadChatMessages() {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`/v1/chat/${currentSessionId}/messages`, {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const messages = await response.json();
            displayChatMessages(messages);
        }
    } catch (error) {
        console.error('Erreur chargement messages:', error);
    }
}

function displayChatMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    container.innerHTML = messages.map(message => `
        <div class="chat-message ${message.role}">
            <div class="message-avatar">${message.role === 'user' ? '👤' : '🤖'}</div>
            <div class="message-content">
                <div class="message-text">${message.content}</div>
                <div class="message-time">${formatDate(message.created_at)}</div>
            </div>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage(event) {
    event.preventDefault();
    
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message || !currentSessionId) return;

    // Ajouter le message utilisateur immédiatement
    addMessageToChat('user', message);
    input.value = '';

    try {
        const response = await fetch(`/v1/chat/${currentSessionId}/message`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (response.ok) {
            const data = await response.json();
            addMessageToChat('assistant', data.content);
            
            // Si un workflow a été créé, rafraîchir la liste
            if (data.metadata?.workflow_created) {
                showNotification(`✅ Workflow "${data.metadata.workflow_created.name}" créé!`, 'success');
            }
        }
    } catch (error) {
        addMessageToChat('assistant', 'Désolé, je rencontre une difficulté technique.');
    }
}

function addMessageToChat(role, content) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${role}`;
    messageEl.innerHTML = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">
            <div class="message-text">${content}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        </div>
    `;
    
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

async function startNewConversation() {
    await startChatConversation();
}

// ===== WORKFLOWS =====
async function loadWorkflowsPage() {
    try {
        const response = await fetch('/v1/workflows', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const workflows = await response.json();
            displayWorkflows(workflows);
        }
    } catch (error) {
        console.error('Erreur chargement workflows:', error);
    }
}

function displayWorkflows(workflows) {
    const container = document.getElementById('workflows-list');
    if (!container) return;
    
    if (workflows.length === 0) {
        container.innerHTML = '<p class="text-center">Aucun workflow créé. Utilisez l\'assistant IA pour en créer un !</p>';
        return;
    }

    container.innerHTML = workflows.map(workflow => `
        <div class="workflow-card">
            <div class="workflow-header">
                <h3>${workflow.name}</h3>
                <span class="workflow-status ${workflow.is_active ? 'active' : 'inactive'}">
                    ${workflow.is_active ? '✅ Actif' : '⏸️ Inactif'}
                </span>
            </div>
            <div class="workflow-details">
                <p><strong>Action:</strong> ${workflow.action_key}</p>
                <p><strong>Créé:</strong> ${formatDate(workflow.created_at)}</p>
            </div>
            <div class="workflow-actions">
                <button onclick="toggleWorkflow(${workflow.id}, ${!workflow.is_active})" class="btn-secondary">
                    ${workflow.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button onclick="deleteWorkflow(${workflow.id})" class="btn-danger">Supprimer</button>
            </div>
        </div>
    `).join('');
}

async function toggleWorkflow(id, isActive) {
    try {
        const response = await fetch(`/v1/workflows/${id}`, {
            method: 'PATCH',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: isActive })
        });

        if (response.ok) {
            loadWorkflowsPage();
            showNotification(`Workflow ${isActive ? 'activé' : 'désactivé'}`, 'success');
        }
    } catch (error) {
        showNotification('Erreur modification workflow', 'error');
    }
}

async function deleteWorkflow(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce workflow ?')) {
        return;
    }

    try {
        const response = await fetch(`/v1/workflows/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            loadWorkflowsPage();
            showNotification('Workflow supprimé', 'success');
        }
    } catch (error) {
        showNotification('Erreur suppression workflow', 'error');
    }
}

// ===== UTILITAIRES =====
function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${sessionToken}`
    };
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString('fr-FR');
}

function showModal(modalId) {
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById(modalId).style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Fermer les modals en cliquant sur l'overlay
document.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.getElementById('modal-overlay').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// Auto-resize textarea
document.addEventListener('input', (e) => {
    if (e.target.id === 'chat-input') {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }
});

// Placeholder functions pour les actions non implémentées
function editUser(id) { alert(`Éditer utilisateur ${id} - À implémenter`); }
function toggleUserStatus(id) { alert(`Toggle status utilisateur ${id} - À implémenter`); }
function deleteUser(id) { alert(`Supprimer utilisateur ${id} - À implémenter`); }