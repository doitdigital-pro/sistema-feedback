import html2canvas from 'html2canvas';

export async function takeScreenshot() {
  try {
    // Tomamos captura del body entero
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      logging: false,
      ignoreElements: (element) => {
        // Ignoramos nuestro propio wrapper del SDK para no capturarlo iterativamente
        return element.id === 'imgc-feedback-root';
      }
    });
    
    // Retorna un base64 de la imagen en baja calidad para ahorrar peso
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch (error) {
    console.error('[IMGC Feedback] Error capturando pantalla:', error);
    return null;
  }
}

export function getMetadata() {
  const userAgent = navigator.userAgent;
  
  // Parseo super básico del navegador (Mejorable después con librerías como UAParser si hace falta)
  let browserName = "Unknown";
  if (userAgent.indexOf("Chrome") > -1) browserName = "Chrome";
  else if (userAgent.indexOf("Safari") > -1) browserName = "Safari";
  else if (userAgent.indexOf("Firefox") > -1) browserName = "Firefox";
  else if (userAgent.indexOf("MSIE") > -1 || !!document.documentMode == true) browserName = "IE";
  
  let osName = "Unknown";
  if (userAgent.indexOf("Win") > -1) osName = "Windows";
  else if (userAgent.indexOf("Mac") > -1) osName = "macOS";
  else if (userAgent.indexOf("Linux") > -1) osName = "Linux";
  else if (userAgent.indexOf("Android") > -1) osName = "Android";
  else if (userAgent.indexOf("like Mac") > -1) osName = "iOS";

  return {
    browserName,
    browserVersion: navigator.appVersion,
    osName,
    osVersion: 'N/A', // Omitido por simplicidad en MVP
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pageUrl: window.location.href,
    pageTitle: document.title
  };
}
