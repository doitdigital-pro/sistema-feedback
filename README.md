# 🎯 IMGC Feedback System

Plataforma completa de **feedback visual en tiempo real**, revisión de sitios web y gestión de tickets.

---

## 🏗️ Arquitectura General

```text
imgc-feedback/
├── backend/       → API REST + WebSockets (Node.js + Express + Prisma + PostgreSQL)
├── frontend/      → Dashboard Admin (React + Vite + Recharts + Lucide Icons)
└── sdk/           → Widget JS embebible para capturar feedback visual e imágenes
```

---

## ⚡ Características Principales

- 📍 **Captura Visual Precisa**: Marcado de pines con coordenadas porcentuales en cualquier resolución.
- 📸 **Screenshots Automáticos**: Captura de pantalla del viewport con `html2canvas`.
- 📋 **Vista de Tickets y Kanban**: Alterna entre tabla interactiva y tablero Kanban por estados.
- 📊 **Activity Log**: Registro detallado de auditoría para todas las acciones del sistema.
- 🤖 **Clasificación por IA**: Integración opcional con Google Gemini para categorización y prioridad.
- 🔔 **Notificaciones en Tiempo Real**: Socket.io + Webhooks para Slack/Discord + Emails SMTP.
- 📤 **Exportación de Reportes**: Descarga de reportes en PDF y CSV.
- 🐳 **Ready for Easypanel / Coolify / Docker**: Dockerfiles y Docker Compose incluidos.

---

## 🚀 Inicio Rápido en Desarrollo Local

### 1. Requisitos Previos
- Node.js v18+ y npm
- PostgreSQL corriendo localmente o URL remota

### 2. Backend
```bash
cd backend
npm install
npx prisma db push
node prisma/seed.js
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. SDK (Widget)
```bash
cd sdk
npm install
npm run dev
```

---

## 🐳 Despliegue en Producción (Easypanel / Coolify)

El proyecto incluye archivos de Docker optimizados:
- `docker-compose.yml` para despliegue en un clic.
- `backend/Dockerfile`
- `frontend/Dockerfile`

### Credenciales Admin Iniciales (después del seed):
- **Email**: `admin@imgc.com`
- **Contraseña**: `admin123`
