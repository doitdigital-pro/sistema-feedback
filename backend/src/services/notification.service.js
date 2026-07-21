const nodemailer = require('nodemailer');
const prisma = require('../prisma');

/**
 * Obtiene las credenciales SMTP de la base de datos con fallback al archivo .env.
 */
async function getDynamicTransporter() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_from']
        }
      }
    });

    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    // Cargar de base de datos o fallar a variables de entorno
    const host = settingsMap['smtp_host'] || process.env.SMTP_HOST;
    const port = settingsMap['smtp_port'] || process.env.SMTP_PORT;
    const user = settingsMap['smtp_user'] || process.env.SMTP_USER;
    const pass = settingsMap['smtp_pass'] || process.env.SMTP_PASS;
    const secure = settingsMap['smtp_secure'] === 'true' || (port === '465');
    const from = settingsMap['smtp_from'] || process.env.SMTP_FROM || 'IMGC Feedback <no-reply@imgc.com>';

    if (host && port && user && pass) {
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: secure,
        auth: { user, pass }
      });
      return { transporter, from };
    }
  } catch (error) {
    console.error('❌ Error al obtener configuración SMTP de base de datos:', error.message);
  }

  // Fallback secundario si falla la consulta (ej. antes de inicializar la BD)
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'IMGC Feedback <no-reply@imgc.com>';

  if (host && port && user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: { user, pass }
    });
    return { transporter, from };
  }

  return null;
}

/**
 * Envía un correo electrónico. Si no hay SMTP configurado, simula el envío en consola.
 */
async function sendEmail({ to, subject, html, text }) {
  const clientInfo = await getDynamicTransporter();

  if (clientInfo) {
    const { transporter, from } = clientInfo;
    try {
      const info = await transporter.sendMail({ from, to, subject, text, html });
      console.log(`✉️  Correo enviado con éxito a: ${to} (ID: ${info.messageId})`);
      return info;
    } catch (error) {
      console.error(`❌ Error al enviar correo SMTP a ${to}:`, error.message);
      return null;
    }
  } else {
    // Modo simulación (desarrollo local)
    const from = process.env.SMTP_FROM || 'IMGC Feedback <no-reply@imgc.com>';
    console.log('\n==================================================');
    console.log(`📧 [SIMULACIÓN CORREO] Enviando a: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(`Texto: ${text || 'Ver versión HTML'}`);
    console.log('--------------------------------------------------');
    console.log(`Contenido HTML:`);
    console.log(html.substring(0, 1000) + (html.length > 1000 ? '\n...[recortado]' : ''));
    console.log('==================================================\n');
    return { simulated: true };
  }
}

/**
 * Envía una notificación webhook a Slack si está configurada la URL
 */
async function sendSlackNotification({ project, site, comment, ticket }) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Construir URLs
    const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`;
    const screenshotFullUrl = comment.screenshotUrl 
      ? (comment.screenshotUrl.startsWith('http') ? comment.screenshotUrl : `${backendUrl}${comment.screenshotUrl}`)
      : null;
      
    // Detectar dispositivo
    const device = (comment.viewportWidth && comment.viewportWidth < 768) ? 'Celular 📱' : 'PC 🖥️';
    const browserInfo = `${comment.browserName || 'Desconocido'} (${comment.osName || 'Desconocido'})`;

    const payload = {
      text: `🆕 Nuevo Feedback en *${project.name}*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🆕 *Nuevo Feedback Visual Recibido en ${project.name}*`
          }
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Sitio:* ${site.name}` },
            { type: "mrkdwn", text: `*Dispositivo:* ${device}` },
            { type: "mrkdwn", text: `*Página:* <${comment.pageUrl}|${comment.pageTitle || 'Ir a la página'}>` },
            { type: "mrkdwn", text: `*Navegador:* ${browserInfo}` }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Comentario:* \n> ${comment.content}`
          }
        }
      ]
    };

    // Añadir imagen de captura si existe
    if (screenshotFullUrl) {
      payload.blocks.push({
        type: "image",
        title: {
          type: "plain_text",
          text: "Captura de pantalla del pin",
          emoji: true
        },
        image_url: screenshotFullUrl,
        alt_text: "Visual feedback screenshot"
      });
    }

    // Añadir botón de acción
    payload.blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Ver Ticket en Dashboard",
            emoji: true
          },
          url: ticketUrl,
          style: "primary"
        }
      ]
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`❌ Webhook Slack devolvió estado no exitoso: ${res.status} - ${txt}`);
    } else {
      console.log('💬 Notificación de Slack enviada con éxito.');
    }
  } catch (error) {
    console.error('❌ Error al enviar webhook de Slack:', error.message);
  }
}

/**
 * Envía una notificación webhook a Discord si está configurada la URL
 */
async function sendDiscordNotification({ project, site, comment, ticket }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Construir URLs
    const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`;
    const screenshotFullUrl = comment.screenshotUrl 
      ? (comment.screenshotUrl.startsWith('http') ? comment.screenshotUrl : `${backendUrl}${comment.screenshotUrl}`)
      : null;

    // Detectar dispositivo
    const device = (comment.viewportWidth && comment.viewportWidth < 768) ? 'Celular 📱' : 'PC 🖥️';
    const browserInfo = `${comment.browserName || 'Desconocido'} (${comment.osName || 'Desconocido'}) - ${comment.screenWidth || '?'}x${comment.screenHeight || '?'}`;

    const payload = {
      embeds: [
        {
          title: `🆕 Nuevo Feedback en ${project.name}`,
          description: `Se ha registrado un comentario visual en el sitio.`,
          url: ticketUrl,
          color: 6516975, // Hex #6366f1 (Indigo) a decimal
          fields: [
            { name: "Sitio Web", value: site.name, inline: true },
            { name: "Vista / Dispositivo", value: device, inline: true },
            { name: "Navegador", value: browserInfo, inline: false },
            { name: "Página", value: `[${comment.pageTitle || 'Ver Página'}](${comment.pageUrl})`, inline: false },
            { name: "Comentario", value: `\`\`\`\n${comment.content}\n\`\`\``, inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "IMGC Feedback System",
          }
        }
      ]
    };

    if (screenshotFullUrl) {
      payload.embeds[0].image = {
        url: screenshotFullUrl
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`❌ Webhook Discord devolvió estado no exitoso: ${res.status} - ${txt}`);
    } else {
      console.log('💬 Notificación de Discord enviada con éxito.');
    }
  } catch (error) {
    console.error('❌ Error al enviar webhook de Discord:', error.message);
  }
}

/**
 * Dispara webhooks de Discord y Slack simultáneamente
 */
async function sendFeedbackWebhooks({ project, site, comment, ticket }) {
  Promise.allSettled([
    sendSlackNotification({ project, site, comment, ticket }),
    sendDiscordNotification({ project, site, comment, ticket })
  ]);
}

/**
 * Envía un correo visual al miembro del equipo cuando se le asigna un ticket
 */
async function sendTicketAssignmentEmail({ assignee, ticket, project, site }) {
  if (!assignee || !assignee.email) return;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0; font-size: 22px;">IMGC Feedback</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Nuevo ticket asignado a tu cuenta</p>
      </div>

      <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Hola ${assignee.name},</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">
          Se te ha asignado el ticket <strong>"${ticket.title}"</strong> en el proyecto <strong>${project.name}</strong> (${site.name}).
        </p>

        <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 13px; color: #334155;">
          <div><strong>Prioridad:</strong> <span style="color: ${ticket.priority === 'URGENT' ? '#7c3aed' : ticket.priority === 'HIGH' ? '#ef4444' : '#f59e0b'}; font-weight: bold;">${ticket.priority || 'MEDIUM'}</span></div>
          <div style="margin-top: 4px;"><strong>Categoría:</strong> ${ticket.category || 'OTHER'}</div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${ticketUrl}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Ver Ticket en el Dashboard →
          </a>
        </div>
      </div>

      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">
        IMGC Feedback System · Notificación automática
      </p>
    </div>
  `;

  return sendEmail({
    to: assignee.email,
    subject: `📋 Te han asignado el ticket: "${ticket.title}" - ${project.name}`,
    html,
    text: `Hola ${assignee.name}, se te ha asignado el ticket "${ticket.title}" en el proyecto ${project.name}. Ver ticket: ${ticketUrl}`,
  });
}

/**
 * Envía un correo a los administradores cuando llega un nuevo feedback
 */
async function sendNewFeedbackAdminEmail({ adminEmails, ticket, comment, project, site }) {
  if (!adminEmails || adminEmails.length === 0) return;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0; font-size: 22px;">IMGC Feedback</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Nuevo comentario visual recibido</p>
      </div>

      <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Nuevo Feedback en ${project.name}</h3>
        <p style="color: #475569; font-size: 14px;"><strong>Sitio:</strong> ${site.name}</p>
        <p style="color: #475569; font-size: 14px;"><strong>Página:</strong> <a href="${comment.pageUrl}" style="color: #4f46e5;">${comment.pageTitle || comment.pageUrl}</a></p>
        
        <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px; margin: 16px 0; font-style: italic; color: #334155; font-size: 14px;">
          "${comment.content}"
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${ticketUrl}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Revisar en Dashboard →
          </a>
        </div>
      </div>

      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">
        IMGC Feedback System · Notificación de sistema
      </p>
    </div>
  `;

  return Promise.all(
    adminEmails.map(email =>
      sendEmail({
        to: email,
        subject: `📩 Nuevo Feedback Recibido en ${project.name}: "${comment.content.substring(0, 30)}..."`,
        html,
        text: `Nuevo feedback recibido en ${project.name}. Comentario: "${comment.content}". Ver: ${ticketUrl}`,
      })
    )
  );
}

module.exports = {
  sendEmail,
  sendSlackNotification,
  sendDiscordNotification,
  sendFeedbackWebhooks,
  sendTicketAssignmentEmail,
  sendNewFeedbackAdminEmail
};
