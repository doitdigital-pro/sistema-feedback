/**
 * Servicio de IA para clasificar y priorizar feedback visual utilizando la API de Gemini.
 */

async function classifyTicket(commentContent) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY no configurado en el archivo .env. Se usará la clasificación por defecto (OTHER / MEDIUM).');
    return { category: 'OTHER', priority: 'MEDIUM' };
  }

  try {
    const prompt = `Analiza el siguiente comentario de feedback de un usuario en un sitio web. Clasifícalo en una categoría y asigna una prioridad recomendada (gravedad percibida).

Categorías válidas:
- UI_DESIGN: Problemas estéticos, diseño, alineación, fuentes, colores, adaptabilidad responsive visual.
- BUG: Errores de funcionalidad, botones que no hacen nada, enlaces rotos, fallas de lógica, formularios que no se envían.
- CONTENT: Errores tipográficos, faltas de ortografía, copys incorrectos, imágenes desactualizadas.
- PERFORMANCE: Lentitud al cargar, retrasos al interactuar, problemas de rendimiento general.
- OTHER: Cualquier otra consulta, pregunta o comentario que no encaje en las anteriores.

Prioridades válidas:
- LOW: Detalles estéticos muy pequeños (ej: margen de 2px), sugerencias de mejora futuras no críticas, dudas menores.
- MEDIUM: Errores estéticos visibles pero que no impiden usar la web, copys erróneos en secciones secundarias, bugs de UI menores.
- HIGH: Fallas funcionales parciales (ej: menú móvil no abre, un botón secundario no funciona), copys erróneos muy visibles (ej: el header principal), lentitud notable.
- URGENT: La web está rota, no se puede comprar/completar el formulario principal, error de servidor 500, pantalla en blanco o colapso del sistema.

Comentario del usuario:
"${commentContent}"`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['UI_DESIGN', 'BUG', 'CONTENT', 'PERFORMANCE', 'OTHER']
              },
              priority: {
                type: 'string',
                enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
              },
              explanation: {
                type: 'string'
              }
            },
            required: ['category', 'priority']
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error en la API de Gemini: ${response.status} - ${errorText}`);
      return { category: 'OTHER', priority: 'MEDIUM' };
    }

    const data = await response.json();
    
    // Extraer y parsear la respuesta JSON generada
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const resultText = data.candidates[0].content.parts[0].text;
      const parsedResult = JSON.parse(resultText.trim());
      
      console.log(`🤖 IA clasificó el feedback: "${commentContent.substring(0, 40)}..." -> Categoría: ${parsedResult.category}, Prioridad: ${parsedResult.priority}`);
      
      return {
        category: parsedResult.category || 'OTHER',
        priority: parsedResult.priority || 'MEDIUM'
      };
    }

    return { category: 'OTHER', priority: 'MEDIUM' };
  } catch (error) {
    console.error('❌ Error durante la clasificación con Gemini IA:', error.message);
    return { category: 'OTHER', priority: 'MEDIUM' };
  }
}

module.exports = {
  classifyTicket
};
