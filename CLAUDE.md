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
- **Supabase**:
  - Auth (Magic link / email-password) + tabla `profiles` (con `last_seen`, `role`).
  - **Edge Function `update-user-profile`** ([src/services/api.ts](src/services/api.ts) → `appsScriptApi.updateProfile`): cambia email en `profiles` **y** sincroniza `auth.users.email` vía service_role. Sin esto, cambiar email en GestionUsuarios desincroniza y crea cuentas duplicadas. Verifica que el caller sea admin.
  - **Tablas de informes del trabajador** (alimentan `WorkerPanel`/`ServiciosDB`/`EntregaDeLlavesDB`/`IncidenciasDB`):
    - `service_reports` (limpiezas reserva + manitas, enum `kind`). Columna `notas` unificada (no `observaciones`/`descripcion`). CHECK `manitas_no_reserva_fields` impide que manitas tenga campos de reserva. `hora_entrada`/`hora_salida`/`horas_extra`/`hora_salida_huesped` son **text HH:MM** (no `time`/`interval`) con CHECK regex.
    - `key_deliveries`. FK `parent_service_id → service_reports.id` (CASCADE) cuando viene anidada del modal de servicio. `created_at`/`updated_at` en **hora de Madrid sin TZ** (`timestamp(0)` con default `date_trunc('second', now() AT TIME ZONE 'Europe/Madrid')`). Trigger `set_updated_at_madrid()`. Bizum: text con CHECK `^[0-9]+$` (solo dígitos, sin espacios).
    - `incident_reports`. Misma FK opcional. `duracion` es **text HH:MM** (no `interval`). `created_at`/`updated_at` también en hora de Madrid sin TZ.
    - `report_drafts` (1 borrador por kind por trabajador). Payload JSONB. RLS: admin gestiona todo; worker gestiona los suyos vía `worker_id IN (SELECT id FROM workers WHERE profile_id = auth.uid())`.
  - **Bucket `signatures`** (Storage): firmas PNG/JPEG hasta 512KB, públicas.
- **Apps Script files**: `CLEAN_STATUS_APPS_SCRIPT.gs`, `SAVE_PDF_APPS_SCRIPT.gs`, `SUGERENCIAS_APPS_SCRIPT.gs`.

## Patrones del repo (a respetar)

1. **MapPickerModal** ([src/components/cleans/CleanCheckoutFormModal.tsx:98-249](src/components/cleans/CleanCheckoutFormModal.tsx#L98-L249)) es la implementación canónica del selector de ubicación. Reutilizarla (o copiarla con `key` para forzar remount al cambiar de campo) en lugar de inventar otra.
2. **Geolocalización del dispositivo** se usa como fallback (`navigator.geolocation.getCurrentPosition`). Centrar siempre en Castellón `[39.9864, -0.0513]` si no hay datos.
3. **Fechas Apps Script**: formato `D/M/YYYY, HH:mm:ss` (no ISO). Hora suelta `HH:MM` con `padStart(2,'0')`.
4. **Filtros / sort / vista**: cada listado (Workers, Cleans, Incidencias…) tiene un `*FilterModal.tsx` o `*SortModal.tsx` separado.
5. **No mocks en producción**: `mockData.ts` exporta tanto tipos como `MOCK_*` para tests/inicialización; los datos reales vienen del Apps Script.
6. **Helpers compartidos de formularios de trabajador** en [src/components/workers/serviceFormHelpers.tsx](src/components/workers/serviceFormHelpers.tsx): `ApartamentoAutocomplete`, `DuracionInput` (Horas+Minutos → emite `"HH:MM"`), `PagoSelector`, `SiNoToggle`, `formatBizumNumber` (formato visual 3-2-2-2; reportsApi limpia con `\D` antes de insertar), `SubmitFooter` (3 estados: idle/draft/send), `inputCls`/`labelCls`. **No duplicar estos componentes en cada modal** — el bug recurrente fue tener una copia local en `ServiceFormModal` que no recibía los fixes del compartido.
7. **Borradores en dos capas**:
   - **Supabase `report_drafts`** ([src/services/reportsApi.ts](src/services/reportsApi.ts)): cuando el trabajador pulsa "Guardar en borrador" → aparece en "Mis borradores" en `WorkerPanel`. Multi-dispositivo.
   - **localStorage** ([src/utils/localDrafts.ts](src/utils/localDrafts.ts)): cuando cierra con X o backdrop sin pulsar Guardar → solo navegador, restaura al reabrir. Pulsar "Cancelar" del footer descarta ambos. Las firmas (base64 grandes) se omiten de los borradores.
8. **Horario y precisión en `service_reports`/`key_deliveries`/`incident_reports`**: timestamps **sin milisegundos**. Horas y duraciones se guardan como `text "HH:MM"` (no `time`/`interval`). `key_deliveries` e `incident_reports` están en hora de Madrid (`timestamp(0)` sin TZ).

## Tareas comunes y dónde tocar

| Tarea | Archivos |
| --- | --- |
| Cambiar UI/lógica de crear incidencia | [src/components/incidencias/IncidentCreateModal.tsx](src/components/incidencias/IncidentCreateModal.tsx) |
| Cambiar UI/lógica de editar incidencia | [src/components/incidencias/IncidentEditModal.tsx](src/components/incidencias/IncidentEditModal.tsx) |
| Cambiar listado/filtros de incidencias | [src/pages/Incidencias.tsx](src/pages/Incidencias.tsx), [src/components/incidencias/IncidentFilterModal.tsx](src/components/incidencias/IncidentFilterModal.tsx) |
| Cambiar selector de mapa | [src/components/cleans/CleanCheckoutFormModal.tsx](src/components/cleans/CleanCheckoutFormModal.tsx) (MapPickerModal) |
| Cambiar payload enviado a Apps Script | [src/services/api.ts](src/services/api.ts) (`appsScriptApi.*`) |
| Añadir/cambiar campo del tipo Incidencia | [src/services/mockData.ts](src/services/mockData.ts#L83-L105) |
| Cambiar formularios trabajador (Servicios/Llaves/Incidencia) | [src/components/workers/ServiceFormModal.tsx](src/components/workers/ServiceFormModal.tsx), [EntregaLlavesFormModal.tsx](src/components/workers/EntregaLlavesFormModal.tsx), [IncidenciaFormModal.tsx](src/components/workers/IncidenciaFormModal.tsx) + [serviceFormHelpers.tsx](src/components/workers/serviceFormHelpers.tsx) |
| Cambiar API de informes (submit/draft/Supabase) | [src/services/reportsApi.ts](src/services/reportsApi.ts) |
| Cambiar panel admin de servicios + popup de vinculados | [src/pages/ServiciosDB.tsx](src/pages/ServiciosDB.tsx) (`LinkedPopup` muestra detalles del key_delivery/incident_report cuyo `parent_service_id` apunta a la fila) |
| Cambiar listado admin de llaves/incidencias | [src/pages/EntregaDeLlavesDB.tsx](src/pages/EntregaDeLlavesDB.tsx), [src/pages/IncidenciasDB.tsx](src/pages/IncidenciasDB.tsx) (usan `supabaseOperationsApi`) |
| Cambiar lista de "Mis borradores" del trabajador | [src/pages/WorkerPanel.tsx](src/pages/WorkerPanel.tsx) |

## Notas

- `.idea/` y `node_modules/` ignorados.
- Hay tres `supabase_migration*.sql` versionados — aplicarlas en orden si se monta un entorno nuevo.
- `index.html` carga la app; Vite sirve en puerto por defecto.
