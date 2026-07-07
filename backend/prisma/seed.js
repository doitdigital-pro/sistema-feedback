/**
 * Seed: crea el usuario admin inicial
 * Ejecutar con: node prisma/seed.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Usuario Admin
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@imgc.com' },
    update: {},
    create: {
      email: 'admin@imgc.com',
      password: passwordHash,
      name: 'Admin IMGC',
      role: 'ADMIN',
    },
  });

  console.log(`✅ Usuario admin creado: ${admin.email}`);

  // Proyecto de prueba
  const project = await prisma.project.upsert({
    where: { id: 'proyecto-demo-001' },
    update: {},
    create: {
      id: 'proyecto-demo-001',
      name: 'Proyecto Demo',
      description: 'Proyecto de prueba para verificar el sistema',
      clientName: 'Cliente Demo',
      clientEmail: 'cliente@demo.com',
      color: '#6366f1',
    },
  });

  console.log(`✅ Proyecto demo creado: ${project.name}`);

  // Sitio de prueba
  const site = await prisma.site.upsert({
    where: { id: 'sitio-demo-001' },
    update: {},
    create: {
      id: 'sitio-demo-001',
      name: 'Sitio Demo',
      url: 'https://demo.imgc.com',
      projectId: project.id,
    },
  });

  console.log(`✅ Sitio demo creado: ${site.name}`);
  console.log(`   SDK Token: ${site.sdkToken}`);

  console.log('\n🎉 Seed completado!');
  console.log('   Email:     admin@imgc.com');
  console.log('   Password:  admin123');
  console.log('   ⚠️  Cambia la contraseña en producción!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
