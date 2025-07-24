-- Table des utilisateurs (doit être créée en premier)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'user', -- admin, user, viewer
  status TEXT DEFAULT 'active', -- active, inactive, suspended
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions utilisateur
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions utilisateur
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- workflow, integration, chat
  resource_id INTEGER,
  permission TEXT NOT NULL, -- read, write, delete, execute
  granted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credentials des intégrations
CREATE TABLE IF NOT EXISTS credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL, -- oauth2, api_key, webhook, smtp
  display_name TEXT NOT NULL,
  encrypted_data JSONB NOT NULL, -- token, refresh_token, api_key, etc.
  config JSONB, -- service-specific configuration
  status TEXT DEFAULT 'active', -- active, expired, error
  last_tested TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_config JSONB NOT NULL,
  action_key TEXT NOT NULL,
  action_props JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exécutions des workflows
CREATE TABLE IF NOT EXISTS executions (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  logs TEXT
);

-- Conversations de chat
CREATE TABLE IF NOT EXISTS chat_conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active', -- active, completed, abandoned
  workflow_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages de chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des agents IA (nouvelle architecture)
CREATE TABLE IF NOT EXISTS ai_agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_type TEXT DEFAULT 'autonomous', -- autonomous, reactive, scheduled, monitoring
  capabilities JSONB DEFAULT '[]', -- ['email_processing', 'data_analysis', etc.]
  generated_code TEXT NOT NULL, -- Code JavaScript généré par Claude
  configuration JSONB DEFAULT '{}', -- Config spécifique à l'agent
  memory JSONB DEFAULT '{}', -- Mémoire persistante de l'agent
  is_active BOOLEAN DEFAULT TRUE,
  deployment_status TEXT DEFAULT 'deployed', -- deployed, stopped, error
  last_execution TIMESTAMPTZ,
  total_executions INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100.0,
  execution_interval INTEGER, -- Minutes entre exécutions (pour agents scheduled)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exécutions des agents IA
CREATE TABLE IF NOT EXISTS agent_executions (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES ai_agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- running, success, error, timeout
  trigger_type TEXT, -- manual, scheduled, webhook, event
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  memory_usage_mb DECIMAL(10,2),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Logs détaillés des agents
CREATE TABLE IF NOT EXISTS agent_logs (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES ai_agents(id) ON DELETE CASCADE,
  execution_id INTEGER REFERENCES agent_executions(id) ON DELETE CASCADE,
  level TEXT NOT NULL, -- debug, info, warn, error
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates d'agents (pour accélérer la création)
CREATE TABLE IF NOT EXISTS agent_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- productivity, marketing, development, monitoring
  capabilities JSONB NOT NULL,
  code_template TEXT NOT NULL,
  default_config JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_id ON ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(is_active, deployment_status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_id ON agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_category ON agent_templates(category);

