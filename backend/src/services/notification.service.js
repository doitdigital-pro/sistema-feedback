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
  // Ejecutar en paralelo sin bloquear el hilo principal de la petición de Express
  Promise.allSettled([
    sendSlackNotification({ project, site, comment, ticket }),
    sendDiscordNotification({ project, site, comment, ticket })
  ]).then(results => {
    // Solo para traza interna de desarrollo
  });
}

module.exports = {
  sendEmail,
  sendSlackNotification,
  sendDiscordNotification,
  sendFeedbackWebhooks
};
