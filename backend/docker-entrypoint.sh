#!/bin/sh
set -e

echo "⏳ Esperando y aplicando migraciones de base de datos..."
npx prisma db push --skip-generate

echo "🌱 Ejecutando seed inicial de base de datos..."
node prisma/seed.js || true

echo "🚀 Iniciando servidor backend..."
exec "$@"
