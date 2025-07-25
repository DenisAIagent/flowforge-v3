import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import pool from './db/pool.js';
import { config } from './config.js';

// Configuration OAuth2 Google
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${config.baseUrl}/auth/google/callback`
);

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export class AuthService {
  
  // Générer URL d'authentification Google
  generateGoogleAuthUrl(type = 'login') {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: JSON.stringify({ type, timestamp: Date.now() })
    });
  }

  // Échanger le code OAuth contre les tokens
  async exchangeCodeForTokens(code) {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      
      // Récupérer infos utilisateur
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();
      
      return {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        google_id: userInfo.id
      };
    } catch (error) {
      console.error('❌ Erreur échange token Google:', error);
      throw new Error('Erreur authentification Google');
    }
  }

  // Vérifier si un utilisateur existe et est approuvé
  async getUserByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erreur récupération utilisateur:', email, error);
      throw error;
    }
  }

  // Créer une demande d'accès
  async createAccessRequest(userInfo) {
    try {
      const requestId = uuidv4();
      const result = await pool.query(`
        INSERT INTO access_requests (id, email, name, picture, google_id, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
        RETURNING *
      `, [requestId, userInfo.email, userInfo.name, userInfo.picture, userInfo.google_id]);
      
      const request = result.rows[0];
      
      // Envoyer email à l'admin
      await this.sendAdminNotification(request);
      
      return request;
    } catch (error) {
      // Si la demande existe déjà, la retourner
      if (error.code === '23505') { // violation unique constraint
        const existing = await pool.query(
          'SELECT * FROM access_requests WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
          [userInfo.email]
        );
        return existing.rows[0];
      }
      
      console.error('❌ Erreur création demande accès:', userInfo.email, error);
      throw error;
    }
  }

  // Envoyer notification email à l'admin
  async sendAdminNotification(accessRequest) {
    try {
      const approveUrl = `${config.baseUrl}/admin/approve/${accessRequest.id}`;
      const rejectUrl = `${config.baseUrl}/admin/reject/${accessRequest.id}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">🔔 Nouvelle demande d'accès FlowForge</h2>
          
          <div style="background: #f8faff; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3>Informations utilisateur:</h3>
            <p><strong>Nom:</strong> ${accessRequest.name}</p>
            <p><strong>Email:</strong> ${accessRequest.email}</p>
            <p><strong>Date:</strong> ${new Date(accessRequest.created_at).toLocaleString('fr-FR')}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${approveUrl}" 
               style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin-right: 15px; display: inline-block;">
              ✅ Approuver l'accès
            </a>
            
            <a href="${rejectUrl}"
               style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
              ❌ Refuser l'accès  
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Ces liens expirent dans 7 jours. Vous pouvez aussi gérer les demandes depuis le 
            <a href="${config.baseUrl}/admin/requests">panel d'administration</a>.
          </p>
        </div>
      `;
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.ADMIN_EMAIL,
        subject: `🔔 Nouvelle demande d'accès FlowForge - ${accessRequest.name}`,
        html: htmlContent
      });
      
      console.log('✅ Email admin envoyé avec succès:', accessRequest.id);
      
    } catch (error) {
      console.error('❌ Erreur envoi email admin:', accessRequest.id, error);
      // Ne pas faire échouer la demande si l'email échoue
    }
  }

  // Approuver une demande d'accès
  async approveAccessRequest(requestId) {
    try {
      // Récupérer la demande
      const requestResult = await pool.query(
        'SELECT * FROM access_requests WHERE id = $1 AND status = $2',
        [requestId, 'pending']
      );
      
      if (requestResult.rows.length === 0) {
        throw new Error('Demande introuvable ou déjà traitée');
      }
      
      const request = requestResult.rows[0];
      
      // Créer l'utilisateur
      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash(uuidv4(), 10); // Mot de passe temporaire
      
      await pool.query(`
        INSERT INTO users (id, email, first_name, last_name, picture, google_id, role, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'user', 'active', NOW())
      `, [
        userId,
        request.email,
        request.name.split(' ')[0],
        request.name.split(' ').slice(1).join(' ') || '',
        request.picture,
        request.google_id
      ]);
      
      // Marquer la demande comme approuvée
      await pool.query(
        'UPDATE access_requests SET status = $1, processed_at = NOW() WHERE id = $2',
        ['approved', requestId]
      );
      
      // Envoyer email de confirmation à l'utilisateur
      await this.sendUserApprovalEmail(request);
      
      console.log('✅ Demande approuvée et utilisateur créé:', requestId, request.email);
      
      return { success: true, message: 'Utilisateur approuvé et créé' };
      
    } catch (error) {
      console.error('❌ Erreur approbation demande:', requestId, error);
      throw error;
    }
  }

  // Refuser une demande d'accès
  async rejectAccessRequest(requestId) {
    try {
      const result = await pool.query(
        'UPDATE access_requests SET status = $1, processed_at = NOW() WHERE id = $2 AND status = $3 RETURNING *',
        ['rejected', requestId, 'pending']
      );
      
      if (result.rows.length === 0) {
        throw new Error('Demande introuvable ou déjà traitée');
      }
      
      const request = result.rows[0];
      
      // Envoyer email de refus à l'utilisateur
      await this.sendUserRejectionEmail(request);
      
      console.log('✅ Demande refusée:', requestId, request.email);
      
      return { success: true, message: 'Demande refusée' };
      
    } catch (error) {
      console.error('❌ Erreur refus demande:', requestId, error);
      throw error;
    }
  }

  // Email d'approbation à l'utilisateur
  async sendUserApprovalEmail(request) {
    try {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">🎉 Votre accès à FlowForge a été approuvé !</h2>
          
          <p>Bonjour ${request.name},</p>
          
          <p>Excellente nouvelle ! Votre demande d'accès à FlowForge a été approuvée par notre équipe.</p>
          
          <div style="background: #dcfce7; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
            <h3 style="color: #166534;">Vous pouvez maintenant vous connecter</h3>
            <a href="${config.baseUrl}" 
               style="background: #1e40af; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 15px;">
              🚀 Accéder à FlowForge
            </a>
          </div>
          
          <p>Bienvenue dans la communauté FlowForge ! Vous pouvez maintenant créer et déployer vos agents IA.</p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Si vous avez des questions, n'hésitez pas à nous contacter.
          </p>
        </div>
      `;
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: request.email,
        subject: '🎉 Votre accès FlowForge a été approuvé !',
        html: htmlContent
      });
      
    } catch (error) {
      console.error('❌ Erreur envoi email approbation:', request.email, error);
    }
  }

  // Email de refus à l'utilisateur
  async sendUserRejectionEmail(request) {
    try {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Demande d'accès FlowForge</h2>
          
          <p>Bonjour ${request.name},</p>
          
          <p>Nous vous remercions pour votre intérêt pour FlowForge.</p>
          
          <p>Malheureusement, nous ne pouvons pas approuver votre demande d'accès pour le moment.</p>
          
          <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez plus d'informations, n'hésitez pas à nous contacter.</p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Équipe FlowForge
          </p>
        </div>
      `;
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: request.email,
        subject: 'Demande d\'accès FlowForge',
        html: htmlContent
      });
      
    } catch (error) {
      console.error('❌ Erreur envoi email refus:', request.email, error);
    }
  }

  // Créer une session utilisateur
  async createUserSession(user) {
    const sessionToken = uuidv4();
    
    try {
      await pool.query(`
        INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        uuidv4(),
        user.id,
        sessionToken,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
      ]);
      
      return sessionToken;
    } catch (error) {
      console.error('❌ Erreur création session:', user.id, error);
      throw error;
    }
  }

  // Valider une session
  async validateSession(sessionToken) {
    try {
      const result = await pool.query(`
        SELECT s.*, u.email, u.first_name, u.last_name, u.role, u.status
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = $1 AND s.expires_at > NOW() AND u.status = 'active'
      `, [sessionToken]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erreur validation session:', error);
      return null;
    }
  }

  // Récupérer les demandes en attente
  async getPendingRequests() {
    try {
      const result = await pool.query(`
        SELECT * FROM access_requests 
        WHERE status = 'pending' 
        ORDER BY created_at DESC
      `);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Erreur récupération demandes pending:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();