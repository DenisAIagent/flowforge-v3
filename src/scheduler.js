import cron from 'node-cron';
import pool from './db/pool.js';
import { ComponentRunner } from './component-runner.js';
import { logger } from './utils/logger.js';

const runner = new ComponentRunner();
cron.schedule('* * * * *', async () => {
  logger.info('Scheduler tick');
  try {
    const res = await pool.query(
      'SELECT id, user_id, trigger_config, action_key, action_props FROM workflows WHERE is_active = true'
    );
    for (const wf of res.rows) {
      const job = {
        workflow_id: wf.id,
        user_id: wf.user_id,
        action_key: wf.action_key,
        action_props: wf.action_props
      };
      runner.run(job);
    }
  } catch (err) {
    logger.error(err, 'Erreur dans le scheduler');
  }
});

