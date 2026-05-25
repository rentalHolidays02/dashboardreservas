# CLAUDE.md

Guía rápida del proyecto **BaseDatosPagosRH** para futuras sesiones de Claude Code.

## Resumen

Aplicación React + TypeScript + Vite para la gestión de RR.HH., limpiezas, incidencias, pagos y alojamientos de una empresa de gestión de pisos turísticos. Persiste datos contra **Google Sheets** vía **Google Apps Script** (proxy/API) y **Supabase** (auth + perfiles). UI con **TailwindCSS** y mapas con **Leaflet**.

## Stack

- **React 18** + **TypeScript 5** + **Vite 5**
- **react-router-dom 6** (rutas SPA)
- **TailwindCSS 3** (estilos)
- **Leaflet** + `@types/leaflet` (mapas — selección de coordenadas)
- **lucide-react** (iconos)
- **recharts** (gráficas en analytics)
- **jspdf** + `jspdf-autotable` (export PDF)
- **@supabase/supabase-js** (auth)
- **clsx** + **tailwind-merge** (composición de clases)

## Scripts

```bash
npm run dev      # Servidor de desarrollo Vite
npm run build    # tsc && vite build
npm run lint     # ESLint
npm run preview  # Previsualizar build
```

## Estructura del proyecto

```
.
├── src/
│   ├── App.tsx                       # Router + providers globales (Theme, NavGuard, UndoToast)
│   ├── main.tsx                      # Entry point
│   ├── index.css                     # Tailwind + estilos globales
│   ├── design-tokens.json            # Tokens de diseño
│   ├── assets/                       # Imágenes/recursos estáticos
│   │
│   ├── pages/                        # Vistas principales (1 archivo = 1 ruta)
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx             # Vista admin/editor/viewer
│   │   ├── WorkerPanel.tsx           # Vista trabajador
│   │   ├── WorkerAnalytics.tsx
│   │   ├── WorkerRecords.tsx
│   │   ├── Cleans.tsx                # Limpiezas (normal / initial / handyman)
│   │   ├── Workers.tsx               # Trabajadores
│   │   ├── Incidencias.tsx           # Listado/filtro de incidencias
│   │   ├── Sugerencias.tsx
│   │   ├── Pagos.tsx
│   │   ├── Alojamientos.tsx
│   │   ├── Analisis.tsx
│   │   ├── GenerarInforme.tsx
│   │   ├── GestionUsuarios.tsx       # Solo admin
│   │   ├── EntregaDeLlaves.tsx
│   │   └── Profile.tsx
│   │
│   ├── components/
│   │   ├── layout/                   # MainLayout, Sidebar, WorkerBottomNav
│   │   ├── ui/                       # LoadingSpinner y primitivas
│   │   ├── chatbot/                  # ChatBot
│   │   ├── dashboard/                # Cards, tablas y modales de Dashboard
│   │   ├── analytics/                # Charts y rankings
│   │   ├── accommodations/           # Modales y cards de alojamientos
│   │   ├── cleans/                   # ⭐ CleanCheckoutFormModal contiene MapPickerModal (referencia para selector de ubicación con minimapa)
│   │   ├── workers/                  # Modales de workers + WorkerProfile
│   │   ├── incidencias/              # IncidentCreateModal, IncidentEditModal, IncidentFilterModal
│   │   ├── pagos/                    # FilterModal de pagos
│   │   └── sugerencias/              # SugerenciasFilterModal
│   │
│   ├── context/                      # ThemeContext, NavigationGuardContext, UndoToastContext
│   ├── hooks/                        # useAnimatedNumber
│   ├── services/
│   │   ├── api.ts                    # Cliente Apps Script (CRUD sheets) + reverseGeocode (Nominatim)
│   │   ├── mockData.ts               # Tipos + datos mock (Incidencia, Worker, Accommodation, EntregaLlaves, …)
│   │   ├── supabaseClient.ts         # Cliente Supabase
│   │   └── pdfExport.ts              # Generación de PDFs
│   └── utils/                        # formatters, analytics, payments
│
├── referencias/                      # CSVs de referencia (datos fiscales, checkout templates)
├── public/                           # Estáticos
├── *.gs                              # Google Apps Script (backend)
├── supabase_migration*.sql           # Migraciones SQL
└── vite.config.ts / tailwind.config.js / tsconfig.json
```

## Convenciones clave

- **Idioma**: UI y comentarios en **castellano**. Mensajes de commit en castellano.
- **Estilo TS**: componentes funcionales con `React.FC` o función declarativa. Hooks de React.
- **Tailwind**: clases largas inline. Paleta principal `stone`/`slate` neutros + acento `orange` (incidencias) y `emerald` (verificado/éxito). Soporte dark mode con `dark:`.
- **Modales**: patrón `fixed inset-0 z-[100+]` con backdrop blur + `animate-in zoom-in-95`. Cabecera + scroll interno + footer fijo.
- **Inputs**: `rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50` + foco `ring-orange-500/20`.
- **Teléfono**: formato móvil español **3-2-2-2** (`612 34 56 78`). Prefijo `+34` por defecto. Se guarda en sheet como `+34 612 34 56 78` (clean) o `34612345678` (incidencia, ver `IncidentCreateModal`).
- **Coordenadas**: string `"lat, lng"` con 5-6 decimales. Selector visual: `MapPickerModal` (en `CleanCheckoutFormModal.tsx`) sobre Leaflet + tiles Carto + reverseGeocode con Nominatim.
- **Roles**: `admin | editor | viewer | trabajador`. Trabajador tiene vista propia (`WorkerPanel`).

## Backend / persistencia

- **Google Sheets** vía Apps Script: el cliente está en `src/services/api.ts` (`appsScriptApi.*`). Las incidencias se guardan en una hoja con columnas `PARADA INICIAL`, `PARADA OPCIONAL 1..5`, `PARADA FINAL`, `KMS`, `TELÉFONO`, etc.
- **Formato de parada guardada en sheet**: `"Nombre (HH:MM) [lat, lng]"` (5 decimales).
- **Overflow de paradas**: si hay más de 4 paradas opcionales, las extras se concatenan en `PARADA OPCIONAL 5` separadas por `\n`.
- **Supabase**: solo auth (Magic link / email-password) + tabla `profiles` (con `last_seen`, `role`).
- **Apps Script files**: `CLEAN_STATUS_APPS_SCRIPT.gs`, `SAVE_PDF_APPS_SCRIPT.gs`, `SUGERENCIAS_APPS_SCRIPT.gs`.

## Patrones del repo (a respetar)

1. **MapPickerModal** ([src/components/cleans/CleanCheckoutFormModal.tsx:98-249](src/components/cleans/CleanCheckoutFormModal.tsx#L98-L249)) es la implementación canónica del selector de ubicación. Reutilizarla (o copiarla con `key` para forzar remount al cambiar de campo) en lugar de inventar otra.
2. **Geolocalización del dispositivo** se usa como fallback (`navigator.geolocation.getCurrentPosition`). Centrar siempre en Castellón `[39.9864, -0.0513]` si no hay datos.
3. **Fechas Apps Script**: formato `D/M/YYYY, HH:mm:ss` (no ISO). Hora suelta `HH:MM` con `padStart(2,'0')`.
4. **Filtros / sort / vista**: cada listado (Workers, Cleans, Incidencias…) tiene un `*FilterModal.tsx` o `*SortModal.tsx` separado.
5. **No mocks en producción**: `mockData.ts` exporta tanto tipos como `MOCK_*` para tests/inicialización; los datos reales vienen del Apps Script.

## Tareas comunes y dónde tocar

| Tarea | Archivos |
| --- | --- |
| Cambiar UI/lógica de crear incidencia | [src/components/incidencias/IncidentCreateModal.tsx](src/components/incidencias/IncidentCreateModal.tsx) |
| Cambiar UI/lógica de editar incidencia | [src/components/incidencias/IncidentEditModal.tsx](src/components/incidencias/IncidentEditModal.tsx) |
| Cambiar listado/filtros de incidencias | [src/pages/Incidencias.tsx](src/pages/Incidencias.tsx), [src/components/incidencias/IncidentFilterModal.tsx](src/components/incidencias/IncidentFilterModal.tsx) |
| Cambiar selector de mapa | [src/components/cleans/CleanCheckoutFormModal.tsx](src/components/cleans/CleanCheckoutFormModal.tsx) (MapPickerModal) |
| Cambiar payload enviado a Apps Script | [src/services/api.ts](src/services/api.ts) (`appsScriptApi.*`) |
| Añadir/cambiar campo del tipo Incidencia | [src/services/mockData.ts](src/services/mockData.ts#L83-L105) |

## Notas

- `.idea/` y `node_modules/` ignorados.
- Hay tres `supabase_migration*.sql` versionados — aplicarlas en orden si se monta un entorno nuevo.
- `index.html` carga la app; Vite sirve en puerto por defecto.
