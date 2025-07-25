-- Schéma de base de données pour l'authentification FlowForge

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    picture TEXT,
    google_id VARCHAR(50) UNIQUE,
    password_hash TEXT, -- Mot de passe hashé avec bcrypt
    email_verified BOOLEAN DEFAULT FALSE, -- Vérification email
    verification_token VARCHAR(255) UNIQUE, -- Token de vérification email
    reset_password_token VARCHAR(255) UNIQUE, -- Token reset mot de passe
    reset_password_expires TIMESTAMP WITH TIME ZONE, -- Expiration token reset
    auth_method VARCHAR(20) DEFAULT 'email' CHECK (auth_method IN ('email', 'google', 'both')),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'banned', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des demandes d'accès
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    picture TEXT,
    google_id VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id),
    notes TEXT
);

-- Table des sessions utilisateur
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insérer un compte administrateur par défaut
INSERT INTO users (id, email, first_name, last_name, role, status) 
VALUES (
    'admin-' || gen_random_uuid(),
    'admin@flowforge.com',
    'Administrateur',
    'FlowForge',
    'admin',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Fonction pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Vue pour les statistiques admin
CREATE OR REPLACE VIEW admin_stats AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
    (SELECT COUNT(*) FROM access_requests WHERE status = 'pending') as pending_requests,
    (SELECT COUNT(*) FROM user_sessions WHERE expires_at > NOW()) as active_sessions,
    (SELECT COUNT(*) FROM access_requests WHERE status = 'approved' AND DATE(processed_at) = CURRENT_DATE) as approved_today;

COMMENT ON TABLE users IS 'Utilisateurs approuvés de FlowForge';
COMMENT ON TABLE access_requests IS 'Demandes d''accès en attente de validation admin';
COMMENT ON TABLE user_sessions IS 'Sessions actives des utilisateurs connectés';
COMMENT ON VIEW admin_stats IS 'Statistiques pour le dashboard admin';