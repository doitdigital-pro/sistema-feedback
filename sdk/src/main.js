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

// Initialize SDK ONLY if we are in an iframe (Review Page)
function init() {
  if (!config.token) {
    console.error('[IMGC Feedback] No token provided.');
    return;
  }

  // Si no está en un iframe, el SDK es invisible y no hace NADA.
  if (!config.isIframe) {
    console.log('[IMGC Feedback] SDK running in public mode (Invisible).');
    return;
  }

  console.log('[IMGC Feedback] SDK activated in Review Mode.');

  // Escuchar mensajes desde el padre (Review Page)
  window.addEventListener('message', handlePostMessage);

  // Inyectar estilos básicos para los pines dentro del iframe
  injectStyles();

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

    // Enviar data al padre (incluyendo datos de scroll)
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

  } catch (error) {
    console.error('[IMGC Feedback] Error taking screenshot:', error);
    // Enviar igual pero sin captura
    window.parent.postMessage({
      type: 'NEW_CLICK',
      data: {
        xPercent,
        yPercent,
        screenshotBase64: null,
        error: 'Failed to capture screen'
      }
    }, config.parentOrigin);
  }
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
