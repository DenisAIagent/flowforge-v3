import pool from './db/pool.js';
import { logger } from './utils/logger.js';
import { decrypt, encrypt } from './crypto.js';
import { Worker } from 'worker_threads';
import fs from 'fs/promises';
import path from 'path';

export class AgentManager {
  constructor() {
    this.runningAgents = new Map(); // agent_id -> worker instance
    this.agentIntervals = new Map(); // agent_id -> interval ID
  }

  // ===== CRÉATION D'AGENTS =====
  
  async createAgent(userId, agentData) {
    const { name, description, agentType, capabilities, generatedCode, configuration } = agentData;
    
    try {
      // Valider le code généré
      await this.validateAgentCode(generatedCode);
      
      // Créer l'agent en base
      const result = await pool.query(`
        INSERT INTO ai_agents (user_id, name, description, agent_type, capabilities, 
                              generated_code, configuration, deployment_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'deployed')
        RETURNING *
      `, [userId, name, description, agentType, JSON.stringify(capabilities), 
          generatedCode, JSON.stringify(configuration)]);
      
      const agent = result.rows[0];
      
      // Déployer immédiatement l'agent
      await this.deployAgent(agent.id);
      
      logger.info({ agent_id: agent.id, user_id: userId }, 
        `Agent "${name}" créé et déployé avec succès`);
      
      return agent;
    } catch (error) {
      logger.error({ error, user_id: userId }, 
        `Erreur création agent "${name}"`);
      throw error;
    }
  }

  // ===== GÉNÉRATION DE CODE D'AGENTS =====
  
  async generateAgentCode(description, capabilities, userIntegrations) {
    // Cette méthode sera intégrée avec Claude pour générer du code intelligent
    const baseTemplate = this.getAgentTemplate(capabilities);
    
    // Template de base pour un agent
    return `
export class GeneratedAgent {
  constructor(credentials, config) {
    this.credentials = credentials;
    this.config = config;
    this.memory = {};
    
    // Initialiser les APIs basées sur les capabilities
    ${this.generateAPIInitialization(capabilities, userIntegrations)}
  }

  async execute(input = {}) {
    try {
      console.log('🤖 Agent démarré:', new Date().toISOString());
      
      // Logique principale générée par Claude
      ${this.generateMainLogic(description, capabilities)}
      
      // Mettre à jour la mémoire de l'agent
      await this.updateMemory();
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        data: input
      };
    } catch (error) {
      console.error('❌ Erreur agent:', error);
      throw error;
    }
  }

  async updateMemory() {
    // Sauvegarder l'état en base de données
    // Cette méthode sera appelée automatiquement
  }

  // Méthodes utilitaires générées dynamiquement
  ${this.generateUtilityMethods(capabilities)}
}
`;
  }

  generateAPIInitialization(capabilities, userIntegrations) {
    let initCode = '';
    
    if (capabilities.includes('email_processing')) {
      initCode += `
    // Gmail API
    this.gmail = new GmailAPI(credentials.google);`;
    }

    if (capabilities.includes('messaging')) {
      initCode += `
    // Slack API
    this.slack = new SlackAPI(credentials.slack);
    // Discord API  
    this.discord = new DiscordAPI(credentials.discord);`;
    }

    if (capabilities.includes('data_analysis')) {
      initCode += `
    // Google Sheets API
    this.sheets = new SheetsAPI(credentials.google);`;
    }

    return initCode;
  }

  generateMainLogic(description, capabilities) {
    // Ici Claude générera la logique spécifique basée sur la description
    return `
      // Logique générée automatiquement par Claude
      // Basée sur: "${description}"
      
      const result = await this.processTask(input);
      console.log('✅ Task processed:', result);
      
      return result;
    `;
  }

  generateUtilityMethods(capabilities) {
    let methods = '';
    
    if (capabilities.includes('email_processing')) {
      methods += `
  async processEmails() {
    const emails = await this.gmail.getUnreadEmails();
    for (const email of emails) {
      await this.processEmail(email);
    }
  }

  async processEmail(email) {
    // Traitement intelligent de l'email
    console.log('📧 Processing email:', email.subject);
  }`;
    }

    return methods;
  }

  getAgentTemplate(capabilities) {
    // Templates pré-définis basés sur les capabilities
    const templates = {
      'email_monitoring': 'EmailMonitoringAgent',
      'social_media': 'SocialMediaAgent', 
      'data_analysis': 'DataAnalysisAgent',
      'automation': 'AutomationAgent'
    };
    
    return templates[capabilities[0]] || 'BaseAgent';
  }

  // ===== DÉPLOIEMENT D'AGENTS =====
  
  async deployAgent(agentId) {
    try {
      const agent = await this.getAgent(agentId);
      
      if (!agent) {
        throw new Error(`Agent ${agentId} non trouvé`);
      }

      // Créer le fichier de l'agent
      const agentPath = await this.createAgentFile(agent);
      
      // Démarrer l'agent selon son type
      switch (agent.agent_type) {
        case 'scheduled':
          await this.startScheduledAgent(agent);
          break;
        case 'monitoring':
          await this.startMonitoringAgent(agent);
          break;
        case 'reactive':
          await this.startReactiveAgent(agent);
          break;
        default:
          // Agent autonome - démarré manuellement
          break;
      }

      // Mettre à jour le statut
      await pool.query(
        'UPDATE ai_agents SET deployment_status = $1, updated_at = NOW() WHERE id = $2',
        ['deployed', agentId]
      );

      logger.info({ agent_id: agentId }, 'Agent déployé avec succès');
      
    } catch (error) {
      await pool.query(
        'UPDATE ai_agents SET deployment_status = $1 WHERE id = $2',
        ['error', agentId]
      );
      
      logger.error({ error, agent_id: agentId }, 'Erreur déploiement agent');
      throw error;
    }
  }

  async createAgentFile(agent) {
    const agentDir = path.join(process.cwd(), 'deployed-agents');
    await fs.mkdir(agentDir, { recursive: true });
    
    const agentPath = path.join(agentDir, `agent-${agent.id}.js`);
    await fs.writeFile(agentPath, agent.generated_code);
    
    return agentPath;
  }

  // ===== EXÉCUTION D'AGENTS =====
  
  async executeAgent(agentId, inputData = {}) {
    const executionId = await this.createExecution(agentId, 'manual', inputData);
    
    try {
      const agent = await this.getAgent(agentId);
      const credentials = await this.getUserCredentials(agent.user_id);
      
      // Créer un worker isolé pour l'agent
      const result = await this.runAgentInWorker(agent, credentials, inputData);
      
      await this.completeExecution(executionId, 'success', result);
      
      return result;
    } catch (error) {
      await this.completeExecution(executionId, 'error', null, error.message);
      throw error;
    }
  }

  async runAgentInWorker(agent, credentials, inputData) {
    return new Promise((resolve, reject) => {
      const workerData = {
        agentCode: agent.generated_code,
        credentials,
        config: agent.configuration,
        inputData
      };

      const worker = new Worker('./src/agent-worker.js', { workerData });
      
      worker.on('message', (result) => {
        if (result.success) {
          resolve(result.data);
        } else {
          reject(new Error(result.error));
        }
      });

      worker.on('error', reject);
      
      // Timeout de 5 minutes
      setTimeout(() => {
        worker.terminate();
        reject(new Error('Agent timeout'));
      }, 5 * 60 * 1000);
    });
  }

  // ===== AGENTS PROGRAMMÉS =====
  
  async startScheduledAgent(agent) {
    const interval = agent.execution_interval || 60; // défaut: 60 minutes
    
    const intervalId = setInterval(async () => {
      try {
        await this.executeAgent(agent.id);
      } catch (error) {
        logger.error({ error, agent_id: agent.id }, 'Erreur exécution programmée');
      }
    }, interval * 60 * 1000);

    this.agentIntervals.set(agent.id, intervalId);
    logger.info({ agent_id: agent.id, interval }, 'Agent programmé démarré');
  }

  // ===== GESTION DE LA MÉMOIRE =====
  
  async updateAgentMemory(agentId, memoryData) {
    await pool.query(
      'UPDATE ai_agents SET memory = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(memoryData), agentId]
    );
  }

  async getAgentMemory(agentId) {
    const result = await pool.query(
      'SELECT memory FROM ai_agents WHERE id = $1',
      [agentId]
    );
    
    return result.rows[0]?.memory || {};
  }

  // ===== UTILITAIRES =====
  
  async getAgent(agentId) {
    const result = await pool.query(
      'SELECT * FROM ai_agents WHERE id = $1',
      [agentId]
    );
    return result.rows[0];
  }

  async getUserCredentials(userId) {
    const result = await pool.query(
      'SELECT service_name, encrypted_data FROM credentials WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    
    const credentials = {};
    for (const row of result.rows) {
      credentials[row.service_name] = JSON.parse(decrypt(row.encrypted_data));
    }
    
    return credentials;
  }

  async createExecution(agentId, triggerType, inputData) {
    const result = await pool.query(
      'INSERT INTO agent_executions (agent_id, status, trigger_type, input_data) VALUES ($1, $2, $3, $4) RETURNING id',
      [agentId, 'running', triggerType, JSON.stringify(inputData)]
    );
    return result.rows[0].id;
  }

  async completeExecution(executionId, status, outputData, errorMessage = null) {
    await pool.query(
      'UPDATE agent_executions SET status = $1, output_data = $2, error_message = $3, finished_at = NOW() WHERE id = $4',
      [status, outputData ? JSON.stringify(outputData) : null, errorMessage, executionId]
    );
  }

  async validateAgentCode(code) {
    // Validation basique du code JavaScript
    try {
      new Function(code);
      return true;
    } catch (error) {
      throw new Error(`Code agent invalide: ${error.message}`);
    }
  }

  // ===== ARRÊT ET NETTOYAGE =====
  
  async stopAgent(agentId) {
    // Arrêter les intervals
    if (this.agentIntervals.has(agentId)) {
      clearInterval(this.agentIntervals.get(agentId));
      this.agentIntervals.delete(agentId);
    }

    // Terminer les workers
    if (this.runningAgents.has(agentId)) {
      const worker = this.runningAgents.get(agentId);
      await worker.terminate();
      this.runningAgents.delete(agentId);
    }

    // Mettre à jour le statut
    await pool.query(
      'UPDATE ai_agents SET deployment_status = $1 WHERE id = $2',
      ['stopped', agentId]
    );
  }

  async shutdown() {
    logger.info('Arrêt du gestionnaire d\'agents...');
    
    for (const [agentId] of this.runningAgents) {
      await this.stopAgent(agentId);
    }
  }
}

export const agentManager = new AgentManager();