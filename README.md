# 📅 Dashboard Reservas · Booking & Airbnb

Dashboard para gestionar reservas de Booking y Airbnb desde Google Sheets, con alertas sonoras para entradas/salidas del día.

## ✨ Funcionalidades

- **Lee automáticamente** el Google Sheet publicado
- **Filtra** solo reservas de Booking y Airbnb
- **Ordena** por fecha de entrada o salida
- **Alarma sonora** cuando hay entradas o salidas del día (se activa al cargar y cada 5 minutos)
- **Teléfono manual**: puedes añadir/editar el teléfono de cada reserva
- **Marcar llamados**: botón para registrar que ya llamaste al cliente
- **Búsqueda** por cualquier campo
- **Filtros rápidos**: Todas / Entradas hoy / Salidas hoy / Booking / Airbnb
- **Auto-refresh** cada 5 minutos

## 🚀 Deploy en Vercel

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit - Dashboard Reservas"
git remote add origin https://github.com/TU_USUARIO/booking-dashboard.git
git push -u origin main
```

### 2. Importar en Vercel

1. Ve a [vercel.com](https://vercel.com) → **New Project**
2. Importa tu repositorio de GitHub
3. Vercel detecta Next.js automáticamente
4. Haz clic en **Deploy** ✅

No necesitas variables de entorno. La app lee el Google Sheet directamente.

## 📊 Requisito del Google Sheet

El Sheet debe estar **publicado en la web** (Archivo → Compartir → Publicar en la web).

La app detecta automáticamente las columnas con nombres como:
- `ORIGEN` → filtra Booking y Airbnb
- `FECHA ENTRADA` / `FECHA SALIDA` → para ordenar y detectar el día de hoy
- `NOMBRE` / `CLIENTE` → nombre del huésped
- `TELÉFONO` → (opcional, también se puede añadir manualmente)

## 🛠 Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)
