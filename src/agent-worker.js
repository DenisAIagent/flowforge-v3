import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';

// APIs disponibles pour les agents
class AgentAPIs {
  constructor(credentials) {
    this.credentials = credentials;
  }

  // ===== GMAIL API =====
  async sendEmail(to, subject, content) {
    if (!this.credentials.google) {
      throw new Error('Credentials Google non configurées');
    }

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.google.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: Buffer.from(`To: ${to}\nSubject: ${subject}\n\n${content}`).toString('base64')
      })
    });

    return await response.json();
  }

  async getUnreadEmails(maxResults = 10) {
    if (!this.credentials.google) {
      throw new Error('Credentials Google non configurées');
    }

    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=${maxResults}`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.google.access_token}`
      }
    });

    const data = await response.json();
    const emails = [];

    if (data.messages) {
      for (const message of data.messages) {
        const emailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.google.access_token}`
          }
        });
        emails.push(await emailResponse.json());
      }
    }

    return emails;
  }

  // ===== SLACK API =====
  async sendSlackMessage(channel, message) {
    if (!this.credentials.slack) {
      throw new Error('Credentials Slack non configurées');
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.slack.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel,
        text: message
      })
    });

    return await response.json();
  }

  // ===== DISCORD API =====
  async sendDiscordMessage(webhookUrl, message) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: message
      })
    });

    return response.ok;
  }

  // ===== GOOGLE SHEETS API =====
  async appendToSheet(spreadsheetId, range, values) {
    if (!this.credentials.google) {
      throw new Error('Credentials Google non configurées');
    }

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.google.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [values]
      })
    });

    return await response.json();
  }

  // ===== GITHUB API =====
  async createGitHubIssue(owner, repo, title, body) {
    if (!this.credentials.github) {
      throw new Error('Credentials GitHub non configurées');
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.github.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        body
      })
    });

    return await response.json();
  }

  // ===== BREVO API =====
  async sendBrevoEmail(to, subject, htmlContent) {
    if (!this.credentials.brevo) {
      throw new Error('Credentials Brevo non configurées');
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.credentials.brevo.api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: 'noreply@flowforge.dev', name: 'FlowForge Agent' },
        to: [{ email: to }],
        subject,
        htmlContent
      })
    });

    return await response.json();
  }

  // ===== CLAUDE API =====
  async analyzeWithClaude(prompt, data) {
    if (!this.credentials.claude) {
      throw new Error('Credentials Claude non configurées');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.credentials.claude.api_key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `${prompt}\n\nData: ${JSON.stringify(data)}`
        }]
      })
    });

    const result = await response.json();
    return result.content[0].text;
  }

  // ===== UTILITAIRES =====
  async httpRequest(url, options = {}) {
    const response = await fetch(url, options);
    return await response.json();
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(message, data = null) {
    console.log(`[${new Date().toISOString()}] ${message}`, data || '');
  }
}

// ===== EXÉCUTION DE L'AGENT =====
async function executeAgent() {
  const startTime = performance.now();
  
  try {
    const { agentCode, credentials, config, inputData } = workerData;
    
    // Créer le contexte d'exécution pour l'agent
    const apis = new AgentAPIs(credentials);
    
    // Variables globales disponibles pour l'agent
    const agentGlobals = {
      console,
      fetch,
      Buffer,
      JSON,
      Date,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      performance,
      
      // APIs FlowForge
      apis,
      config,
      input: inputData,
      
      // Raccourcis pour les APIs les plus courantes
      sendEmail: apis.sendEmail.bind(apis),
      sendSlackMessage: apis.sendSlackMessage.bind(apis),
      sendDiscordMessage: apis.sendDiscordMessage.bind(apis),
      analyzeWithClaude: apis.analyzeWithClaude.bind(apis),
      log: apis.log.bind(apis),
      wait: apis.wait.bind(apis)
    };

    // Créer une fonction à partir du code de l'agent
    const agentFunction = new Function(
      ...Object.keys(agentGlobals),
      `
      ${agentCode}
      
      // Si le code définit une classe, l'instancier et exécuter
      if (typeof GeneratedAgent !== 'undefined') {
        const agent = new GeneratedAgent(credentials, config);
        return agent.execute(input);
      }
      
      // Sinon, exécuter directement le code
      return Promise.resolve(input);
      `
    );

    // Exécuter l'agent dans un contexte isolé
    const result = await agentFunction(...Object.values(agentGlobals));
    
    const executionTime = performance.now() - startTime;
    
    // Envoyer le résultat au thread principal
    parentPort.postMessage({
      success: true,
      data: result,
      executionTime: Math.round(executionTime),
      memoryUsage: process.memoryUsage()
    });

  } catch (error) {
    const executionTime = performance.now() - startTime;
    
    parentPort.postMessage({
      success: false,
      error: error.message,
      stack: error.stack,
      executionTime: Math.round(executionTime)
    });
  }
}

// Démarrer l'exécution
executeAgent();