const prisma = require('../prisma');

async function expireDemos() {
  try {
    const now = new Date();
    
    // Buscar usuarios demo activos cuya fecha de expiración ya pasó
    const expiredRequests = await prisma.demoRequest.findMany({
      where: {
        status: 'APPROVED',
        expiresAt: { lt: now }
      },
      include: { demoUser: true }
    });

    if (expiredRequests.length > 0) {
      console.log(`🧹 Encontradas ${expiredRequests.length} cuentas demo expiradas. Desactivando...`);
      
      for (const request of expiredRequests) {
        // Desactivar el usuario para que no pueda hacer login
        if (request.demoUserId) {
          await prisma.user.update({
            where: { id: request.demoUserId },
            data: { isActive: false }
          });
          console.log(`   - Usuario temporal desactivado: ${request.demoUser?.email}`);
        }

        // Marcar la solicitud como EXPIRED
        await prisma.demoRequest.update({
          where: { id: request.id },
          data: { status: 'EXPIRED' }
        });
      }
      
      console.log('✅ Expiración de demos completada.');
    }
  } catch (error) {
    console.error('❌ Error expirando cuentas demo:', error);
  }
}

// Iniciar el chequeo cada 5 minutos
function startDemoExpirator() {
  console.log('⏳ Iniciando servicio de expiración de demos...');
  // Ejecutar una vez al inicio
  expireDemos();
  // Luego cada 5 minutos
  setInterval(expireDemos, 5 * 60 * 1000);
}

module.exports = { startDemoExpirator };
