import fetch from 'node-fetch';
import { config } from '../config.js';

export async function sendFailureAlert({ workflow_id, error }) {
  const payload = {
    content: `🚨 Workflow ${workflow_id} a échoué : ${error}`
  };
  await fetch(config.discordWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

