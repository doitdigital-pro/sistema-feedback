import html2canvas from 'html2canvas';

// SDK Configuration
const config = {
  token: window.IMGC_FEEDBACK_TOKEN || null,
  isIframe: window.self !== window.top,
  parentOrigin: '*' // Idealmente aquí debería ir la URL de tu dashboard (http://localhost:5173), pero con '*' es más flexible en dev
};

// State
let feedbackMode = false;
let existingPins = [];
let tempPin = null;

// Initialize SDK
function init() {
  if (!config.token) {
    console.error('[IMGC Feedback] No token provided.');
    return;
  }

  injectStyles();

  // Si no está en un iframe, activamos el Botón Flotante Público (Standalone Widget)
  if (!config.isIframe) {
    console.log('[IMGC Feedback] SDK running in public widget mode.');
    renderFloatingButton();
    return;
  }

  console.log('[IMGC Feedback] SDK activated in Review Mode.');

  // Escuchar mensajes desde el padre (Review Page)
  window.addEventListener('message', handlePostMessage);

  // Iniciar polling para detectar navegación SPA de manera infalible
  startUrlPolling();

  // Notificar al padre que el SDK ha cargado en esta URL
  window.parent.postMessage({
    type: 'SDK_LOADED',
    url: window.location.href
  }, config.parentOrigin);
}

// Polling de URL periódico (cada 300ms) para detectar cambios dinámicos en SPAs
function startUrlPolling() {
  let lastUrl = window.location.href;
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('[IMGC Feedback SDK] URL change detected via polling:', currentUrl);
      window.parent.postMessage({
        type: 'SDK_LOADED',
        url: currentUrl
      }, config.parentOrigin);
    }
  }, 300);
}

function handlePostMessage(event) {
  const data = event.data;
  
  if (!data || !data.type) return;

  switch (data.type) {
    case 'INIT_REVIEW':
      // Cargar pines existentes
      renderExistingPins(data.comments || []);
      break;
    
    case 'TOGGLE_FEEDBACK_MODE':
      feedbackMode = data.active;
      if (feedbackMode) {
        document.body.style.cursor = 'crosshair';
        document.addEventListener('click', handleDocumentClick, true); // capture phase
      } else {
        document.body.style.cursor = 'default';
        document.removeEventListener('click', handleDocumentClick, true);
        removeTempPin();
      }
      break;
      
    case 'COMMENT_SAVED':
      // Se guardó un comentario, añadimos el pin a la lista final y quitamos el temporal
      removeTempPin();
      if (data.comment) {
        renderExistingPins([...existingPins, data.comment]);
      }
      break;
      
    case 'CANCEL_COMMENT':
      removeTempPin();
      break;
  }
}

async function handleDocumentClick(e) {
  if (!feedbackMode) return;
  
  e.preventDefault();
  e.stopPropagation();

  // Coordenadas respecto al viewport visible (para que coincida con el screenshot del viewport)
  const clientX = e.clientX;
  const clientY = e.clientY;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  const xPercent = (clientX / viewportWidth) * 100;
  const yPercent = (clientY / viewportHeight) * 100;

  // Coordenadas absolutas respecto al documento (en píxeles) para dibujar el pin temporal
  const absoluteX = clientX + window.scrollX;
  const absoluteY = clientY + window.scrollY;

  // Dibujar pin temporal en posición absoluta en el documento
  drawTempPin(absoluteX, absoluteY);

  // Avisar al padre que estamos tomando captura
  window.parent.postMessage({ type: 'TAKING_SCREENSHOT' }, config.parentOrigin);

  try {
    // Tomar captura de pantalla
    const canvas = await html2canvas(document.documentElement, {
      useCORS: true,
      scale: 1, // Reducir calidad para enviar rápido
      logging: false,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    
    const screenshotBase64 = canvas.toDataURL('image/jpeg', 0.7);
    
    const browserInfo = {
      browserName: navigator.userAgent, // Simplificado para este paso
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };

    if (config.isIframe) {
      // Enviar data al padre (Review Page)
      window.parent.postMessage({
        type: 'NEW_CLICK',
        data: {
          xPercent,
          yPercent,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          screenshotBase64,
          browserInfo
        }
      }, config.parentOrigin);
    } else {
      // Modo Standalone: Mostrar modal de envío directo en la página
      showStandaloneModal({
        xPercent,
        yPercent,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        screenshotBase64,
        browserInfo
      });
    }

  } catch (error) {
    console.error('[IMGC Feedback] Error taking screenshot:', error);
    if (config.isIframe) {
      window.parent.postMessage({
        type: 'NEW_CLICK',
        data: { xPercent, yPercent, scrollX: window.scrollX, scrollY: window.scrollY, browserInfo }
      }, config.parentOrigin);
    }
  }
}

function renderFloatingButton() {
  if (document.getElementById('imgc-widget-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'imgc-widget-btn';
  btn.innerHTML = '💬 Feedback';
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #4f46e5;
    color: white;
    border: none;
    padding: 12px 22px;
    border-radius: 30px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 600;
    font-size: 14px;
    box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
    cursor: pointer;
    z-index: 2147483646;
    transition: transform 0.2s, background 0.2s;
  `;

  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.05)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });

  btn.addEventListener('click', () => {
    feedbackMode = !feedbackMode;
    if (feedbackMode) {
      btn.style.background = '#ef4444';
      btn.innerHTML = '✖ Cancelar';
      document.body.style.cursor = 'crosshair';
      document.addEventListener('click', handleDocumentClick, true);
    } else {
      btn.style.background = '#4f46e5';
      btn.innerHTML = '💬 Feedback';
      document.body.style.cursor = 'default';
      document.removeEventListener('click', handleDocumentClick, true);
      removeTempPin();
      removeStandaloneModal();
    }
  });

  document.body.appendChild(btn);
}

function showStandaloneModal(data) {
  removeStandaloneModal();

  const modal = document.createElement('div');
  modal.id = 'imgc-standalone-modal';
  modal.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    width: 320px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    border: 1px solid #e2e8f0;
    padding: 16px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  modal.innerHTML = `
    <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;">Enviar Feedback</h4>
    <p style="margin: 0 0 12px 0; color: #64748b; font-size: 12px;">Comentario sobre la zona marcada (+)</p>
    <textarea id="imgc-comment-input" rows="3" placeholder="Escribe tu comentario aquí..." style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; box-sizing: border-box; resize: vertical; margin-bottom: 12px;"></textarea>
    <div style="display: flex; justify-content: flex-end; gap: 8px;">
      <button id="imgc-cancel-btn" style="padding: 6px 12px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; cursor: pointer; font-size: 12px; color: #64748b;">Cancelar</button>
      <button id="imgc-submit-btn" style="padding: 6px 14px; border: none; background: #4f46e5; color: white; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Enviar Feedback</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('imgc-cancel-btn').addEventListener('click', () => {
    removeTempPin();
    removeStandaloneModal();
  });

  document.getElementById('imgc-submit-btn').addEventListener('click', async () => {
    const input = document.getElementById('imgc-comment-input');
    const content = input ? input.value.trim() : '';
    if (!content) return alert('Escribe un comentario antes de enviar.');

    const submitBtn = document.getElementById('imgc-submit-btn');
    submitBtn.innerText = 'Enviando...';
    submitBtn.disabled = true;

    try {
      const backendUrl = import.meta.env?.VITE_BACKEND_URL || 'http://localhost:3001';
      const formData = new FormData();
      formData.append('content', content);
      formData.append('pageUrl', window.location.href);
      formData.append('pageTitle', document.title);
      formData.append('xPercent', data.xPercent);
      formData.append('yPercent', data.yPercent);
      formData.append('scrollX', data.scrollX);
      formData.append('scrollY', data.scrollY);
      formData.append('viewportWidth', data.browserInfo.viewportWidth);
      formData.append('viewportHeight', data.browserInfo.viewportHeight);
      formData.append('browserName', navigator.userAgent);
      if (data.screenshotBase64) {
        formData.append('screenshotBase64', data.screenshotBase64);
      }

      const res = await fetch(`${backendUrl}/api/feedback`, {
        method: 'POST',
        headers: {
          'x-sdk-token': config.token,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Error al guardar el feedback.');

      alert('¡Gracias! Tu feedback se ha enviado correctamente.');
      removeTempPin();
      removeStandaloneModal();

      const widgetBtn = document.getElementById('imgc-widget-btn');
      if (widgetBtn) {
        widgetBtn.click(); // Salir del modo feedback
      }
    } catch (err) {
      console.error(err);
      alert('Error al enviar feedback. Intenta de nuevo.');
      submitBtn.innerText = 'Enviar Feedback';
      submitBtn.disabled = false;
    }
  });
}

function removeStandaloneModal() {
  const existing = document.getElementById('imgc-standalone-modal');
  if (existing) existing.remove();
}

let pinsContainer = null;

// Obtener o crear el contenedor de pines global a nivel de html para una alineación 100% precisa
function getPinsContainer() {
  if (pinsContainer && pinsContainer.parentNode) return pinsContainer;
  
  pinsContainer = document.createElement('div');
  pinsContainer.id = 'imgc-pins-container';
  pinsContainer.style.position = 'absolute';
  pinsContainer.style.top = '0';
  pinsContainer.style.left = '0';
  pinsContainer.style.width = '100%';
  pinsContainer.style.pointerEvents = 'none';
  pinsContainer.style.zIndex = '2147483647';
  
  document.documentElement.appendChild(pinsContainer);
  return pinsContainer;
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .imgc-pin {
      position: absolute;
      width: 28px;
      height: 28px;
      background: #4f46e5;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: sans-serif;
      font-size: 13px;
      font-weight: bold;
      transform: translate(-50%, -50%);
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      border: 2px solid white;
      z-index: 2147483647; /* Máximo z-index */
      transition: transform 0.2s;
      pointer-events: auto; /* Permitir interacción */
    }
    .imgc-pin:hover { transform: translate(-50%, -50%) scale(1.1); }
    .imgc-pin.new { background: #ef4444; animation: imgc-pulse 1.5s infinite; }
    
    @keyframes imgc-pulse {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
  `;
  document.head.appendChild(style);
}

function renderExistingPins(comments) {
  existingPins = comments;
  const container = getPinsContainer();
  
  // Limpiar anteriores
  const oldPins = container.querySelectorAll('.imgc-pin:not(.new)');
  oldPins.forEach(p => p.remove());

  comments.forEach((comment, index) => {
    const pin = document.createElement('div');
    pin.className = 'imgc-pin';
    
    // Reconstruir la posición absoluta en píxeles
    const vWidth = comment.viewportWidth || window.innerWidth;
    const vHeight = comment.viewportHeight || window.innerHeight;
    const sX = comment.scrollX !== null && comment.scrollX !== undefined ? comment.scrollX : 0;
    const sY = comment.scrollY !== null && comment.scrollY !== undefined ? comment.scrollY : 0;

    const absX = (comment.xPercent / 100) * vWidth + sX;
    const absY = (comment.yPercent / 100) * vHeight + sY;

    // Posicionar con píxeles absolutos respecto al origen real del documento
    pin.style.left = `${absX}px`;
    pin.style.top = `${absY}px`;
    
    // Usar el número de secuencia estático global del comentario
    pin.textContent = comment.sequenceNumber || (index + 1);
    
    // Al hacer clic en un pin, avisar al padre para abrir el sidebar
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.parent.postMessage({
        type: 'PIN_CLICKED',
        commentId: comment.id
      }, config.parentOrigin);
    });

    container.appendChild(pin);
  });
}

function drawTempPin(x, y) {
  removeTempPin();
  const container = getPinsContainer();
  
  tempPin = document.createElement('div');
  tempPin.className = 'imgc-pin new';
  tempPin.style.left = `${x}px`;
  tempPin.style.top = `${y}px`;
  tempPin.textContent = '+';
  container.appendChild(tempPin);
}

function removeTempPin() {
  if (tempPin && tempPin.parentNode) {
    tempPin.parentNode.removeChild(tempPin);
    tempPin = null;
  }
}

// Iniciar al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
