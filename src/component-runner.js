import pool from './db/pool.js';
import { decrypt } from './crypto.js';
import { logger } from './utils/logger.js';
import { sendFailureAlert } from './utils/alert.js';
import path from 'path';

export class ComponentRunner {
  async run(job) {
    const { workflow_id, action_key, action_props, user_id } = job;
    const [appName, actionName] = action_key.split('-');
    
    // Récupérer les credentials de l'utilisateur pour ce service
    const credRes = await pool.query(
      'SELECT encrypted_data FROM credentials WHERE service_name = $1 AND user_id = $2 AND status = $3 ORDER BY created_at DESC LIMIT 1',
      [appName, user_id, 'active']
    );
    
    if (credRes.rows.length === 0) {
      throw new Error(`Aucune intégration configurée pour ${appName}`);
    }
    
    const credentialsData = JSON.parse(decrypt(credRes.rows[0].encrypted_data));
    const token = credentialsData.api_key || credentialsData.token || credentialsData.webhook_url;

    const componentPath = path.resolve(
      process.cwd(),
      'pipedream-components',
      'components',
      appName,
      'actions',
      actionName,
      `${actionName}.mjs`
    );

    const componentModule = await import(`file://${componentPath}`);
    const component = componentModule.default;

    const runParams = {
      props: action_props,
      auths: {
        [appName]: { token }
      }
    };

    const execRes = await pool.query(
      'INSERT INTO executions(workflow_id, status, logs) VALUES($1,$2,$3) RETURNING id',
      [workflow_id, 'running', '']
    );
    const executionId = execRes.rows[0].id;
    logger.info({ workflow_id, user_id }, `Démarrage exécution ${executionId}`);

    try {
      const result = await component.run(runParams);
      const finishedAt = new Date();
      await pool.query(
        'UPDATE executions SET status=$1, finished_at=$2, logs=$3 WHERE id=$4',
        ['success', finishedAt, JSON.stringify(result), executionId]
      );
      logger.info({ workflow_id, user_id }, `Exécution ${executionId} réussie`);
      return result;
    } catch (error) {
      const finishedAt = new Date();
      await pool.query(
        'UPDATE executions SET status=$1, finished_at=$2, logs=$3 WHERE id=$4',
        ['error', finishedAt, error.toString(), executionId]
      );
      logger.error({ workflow_id, user_id, err: error }, `Échec exécution ${executionId}`);
      await sendFailureAlert({ workflow_id, error: error.toString() });
      throw error;
    }
  }
}

