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
│   │   ├── api.ts                    # Supabase CRUD (workers, cleans, accommodations, checkins, etc) + Apps Script (Sheets migration) + reverseGeocode (Nominatim)
│   │   ├── reportsApi.ts             # Supabase reports (service_reports, key_deliveries, incident_reports, drafts)
│   │   ├── supabaseOperationsApi.ts  # Admin operations (delete, update batch)
│   │   ├── mockData.ts               # Tipos + datos mock (Incidencia, Worker, Accommodation, EntregaLlaves, …)
│   │   ├── supabaseClient.ts         # Cliente Supabase (memStore session storage, no Web Lock)
│   │   └── pdfExport.ts              # Generación de PDFs
│   └── utils/                        # formatters, analytics, payments, localDrafts
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

### Migración Apps Script → Supabase (Estado: **95% completado**)
- **Migrado a Supabase** (tablas + CRUD): `workers`, `cleans`, `accommodations`, `suggestions`, `entrega_llaves_logistica`, `incidencias_logistica`, `service_reports`, `key_deliveries`, `incident_reports`, `report_drafts`, `worker_sensitive_data`, `worker_accommodations`.
- **Aún en Apps Script/Sheets** (por diseño): Checkins (`Checkin_Limpieza_Normal`, `Checkin_Limpieza_Inicial`, `Checkin_Manitas`) — alimentados por sistema de reservas externo, se sincronizan a Supabase vía Apps Script cada 10 minutos.
- **Migration singletons** (`_migrationsConfirmed` Set en `api.ts`): Funciones `migrateIncidenciasFromSheets()` y `migrateEntregaLlavesFromSheets()` corren una sola vez por sesión. Tras confirmar que los datos existen (count > 0), se registran en el Set y retornan `{skipped:true}` sin tocar la red. Esto evita N llamadas de `Incidencias.tsx` / `EntregaDeLlaves.tsx` al count de Supabase.

### Checkins: Sync Apps Script → Supabase (cada 10 min)
- **Script**: `SyncCheckins.gs` en Google Apps Script project `Limpiezas.BaseDatosPagos`.
- **Fuente**: Hojas `Checkin_Limpieza_Normal`, `Checkin_Limpieza_Inicial`, `Checkin_Manitas` en spreadsheet `VITE_CLEANS_SPREADSHEET_ID`.
- **Destino**: Tabla Supabase `checkins` (columnas: `id`, `type` {normal|initial|handyman}, `telefono`, `nombre`, `apellidos`, `checkin_fecha`, `checkin_ubicacion`, `checkout_fecha`, `checkout_ubicacion`, `apartamento`, `hora_entrada`, `hora_salida`, `sigue_huesped`, `fecha_salida_reserva`, `recoge_llaves`, `km`, `observaciones`, `checked`).
- **Identidad**: `id = "${type}-${rowIndex}"` (ej: `"handyman-2"`) para upsert idempotente.
- **Nota**: Columna de entrada varía por tipo: normal/initial usan `Hora Limpieza Entrada`, handyman usa `Hora Reparacion Entrada`.

### Google Sheets
- Las incidencias históricas se guarden con paradas en formato: `"Nombre (HH:MM) [lat, lng]"` (5 decimales).
- Overflow de paradas: si > 4 paradas opcionales, se concatenan en `PARADA OPCIONAL 5` separadas por `\n`.

### Supabase
- **Auth**: Magic link + email-password. Tabla `profiles` (id, email, full_name, phone, role, last_seen, avatar_url).
- **Storage**: Bucket `signatures` (firmas PNG/JPEG ≤512KB, públicas). Bucket `pdfs` (privado).
- **Edge Function `update-user-profile`** ([src/services/api.ts](src/services/api.ts) → `appsScriptApi.updateProfile`): sincroniza email entre `profiles` (pública) y `auth.users` (privada) vía service_role. Sin esto, cambiar email en GestionUsuarios crea duplicados. Requiere role `admin`.
- **Tablas de informes del trabajador** (alimentan `WorkerPanel`/`ServiciosDB`/`EntregaDeLlavesDB`/`IncidenciasDB`):
  - `service_reports` (limpiezas reserva + manitas, enum `kind`). Columna `notas` unificada (no `observaciones`/`descripcion`). CHECK `manitas_no_reserva_fields` impide campos de reserva en manitas. `hora_entrada`/`hora_salida`/`horas_extra`/`hora_salida_huesped` son **text HH:MM** (no `time`/`interval`) con CHECK regex.
  - `key_deliveries`. FK `parent_service_id → service_reports.id` (CASCADE). `created_at`/`updated_at` en **hora de Madrid sin TZ** (`timestamp(0)`, default: `date_trunc('second', now() AT TIME ZONE 'Europe/Madrid')`). Trigger `set_updated_at_madrid()`. Bizum: text CHECK `^[0-9]+$` (dígitos solo, sin espacios).
  - `incident_reports`. Misma FK opcional. `duracion` **text HH:MM**. Timestamps Madrid sin TZ.
  - `report_drafts` (1 borrador/kind/trabajador). Payload JSONB, firmas base64 omitidas. RLS: admin gestiona todo; worker gestiona los suyos vía `worker_id IN (SELECT id FROM workers WHERE profile_id = auth.uid())`.

### Session storage (Auth)
- **No Web Lock API**: `supabaseClient.ts` usa `memStore` (Map sincrónico) como storage del SDK, evita deadlocks.
- **Login fetch nativo**: `POST /auth/v1/token?grant_type=password` + tokens escritos en `memStore`. El SDK luego lee sin red en `.getSession()`.
- **No persiste entre recargas**: Como `sessionStorage`, pero sin riesgos de locks en login/logout.

## Patrones del repo (a respetar)

1. **MapPickerModal** ([src/components/cleans/CleanCheckoutFormModal.tsx:98-249](src/components/cleans/CleanCheckoutFormModal.tsx#L98-L249)) es la implementación canónica del selector de ubicación. Reutilizarla (o copiarla con `key` para forzar remount al cambiar de campo) en lugar de inventar otra.
2. **Geolocalización del dispositivo** se usa como fallback (`navigator.geolocation.getCurrentPosition`). Centrar siempre en Castellón `[39.9864, -0.0513]` si no hay datos.
3. **Fechas Apps Script**: formato `D/M/YYYY, HH:mm:ss` (no ISO). Hora suelta `HH:MM` con `padStart(2,'0')`.
4. **Filtros / sort / vista**: cada listado (Workers, Cleans, Incidencias…) tiene un `*FilterModal.tsx` o `*SortModal.tsx` separado.
5. **No mocks en producción**: `mockData.ts` exporta tanto tipos como `MOCK_*` para tests/inicialización; los datos reales vienen de Supabase.
6. **Helpers compartidos de formularios de trabajador** en [src/components/workers/serviceFormHelpers.tsx](src/components/workers/serviceFormHelpers.tsx): `ApartamentoAutocomplete`, `DuracionInput` (Horas+Minutos → emite `"HH:MM"`), `PagoSelector`, `SiNoToggle`, `formatBizumNumber` (formato visual 3-2-2-2; reportsApi limpia con `\D` antes de insertar), `SubmitFooter` (3 estados: idle/draft/send), `inputCls`/`labelCls`. **No duplicar estos componentes en cada modal** — el bug recurrente fue tener una copia local en `ServiceFormModal` que no recibía los fixes del compartido.
7. **Borradores en dos capas**:
   - **Supabase `report_drafts`** ([src/services/reportsApi.ts](src/services/reportsApi.ts)): cuando el trabajador pulsa "Guardar en borrador" → aparece en "Mis borradores" en `WorkerPanel`. Multi-dispositivo.
   - **localStorage** ([src/utils/localDrafts.ts](src/utils/localDrafts.ts)): cuando cierra con X o backdrop sin pulsar Guardar → solo navegador, restaura al reabrir. Pulsar "Cancelar" del footer descarta ambos.
   - **Las firmas SÍ se incluyen en el payload** (base64 ~100 KB total — insignificante para Supabase JSONB). No excluirlas o las firmas desaparecen al restaurar borrador (ver error #16).
8. **Horario y precisión en `service_reports`/`key_deliveries`/`incident_reports`**: timestamps **sin milisegundos**. Horas y duraciones se guardan como `text "HH:MM"` (no `time`/`interval`). `key_deliveries` e `incident_reports` están en hora de Madrid (`timestamp(0)` sin TZ).
9. **Migration singletons** ([src/services/api.ts](src/services/api.ts) línea ~35): Usar `_migrationsConfirmed` Set para funciones que migran datos únicos. Tras primer `count > 0`, guardar en Set y retornar O(1) sin consultar Supabase. Evita N+1 al recargar la misma página.
10. **Error handling en async + setState**: **Todo `async` que actualiza estado debe tener `catch` explícito.** `try/finally` sin `catch` oculta errores de mapeo/parsing, dejando la UI en estado vacío sin logs. Ejemplo: `GestionUsuarios.tsx` línea ~705.
11. **Nunca caer a Apps Script como fallback**: Si `supabase.from(...).select()` falla, lanzar error o devolver `[]`. El Apps Script es solo para migraciones únicas de datos históricos. Llamarlo en error handler causa latencias de 300-600ms.
12. **Evitar N+1 en `getWorkers()`**: La función `getWorkers()` ya carga internamente cleans, handyman, entrega de llaves para calcular earnings. No llamarlas de nuevo en el mismo `Promise.all()` en Dashboard.tsx u otro componente padre.
13. **No delays arbitrarios en funciones que bloquean UI**: Funciones como `getRecentCheckIns()` no deben tener `await delay()` si se llaman desde `Promise.all()` que controla spinners. Bloquea el `Promise.all` entero.
14. **`getSession()` en lugar de `getUser()` para obtener UID**: `getUser()` hace red para validar token; si el SDK inicializa frío falla aunque storage tenga el token → datos vacíos sin error visible. Usar `getSession()` (lee de storage) en `reportsApi.ts` y similares. Solo `getUser()` en paths de seguridad crítica (admin actions).
15. **memStorage sincroniza con sessionStorage**: `supabaseClient.ts` usa `memStorage` que hace backup en `sessionStorage`. Token sobrevive F5. Logout limpia ambos via `App.tsx`. No añadir otro mecanismo de persistencia de token.
16. **Leer `docs/` antes de tocar cualquier archivo**: Antes de cada corrección, leer `docs/errores_conocidos.md` y `docs/decisiones.md` para no repetir errores resueltos ni contradecir decisiones tomadas.
17. **Touch events en canvas: usar `useEffect` con `{ passive: false }`**: React registra `onTouchStart/Move/End` como passive → `e.preventDefault()` no funciona y genera warnings. Cualquier canvas que necesite bloquear scroll durante interacción debe registrar sus listeners vía `addEventListener(..., { passive: false })` en `useEffect`, quitándolos del JSX. Ver `SignaturePad.tsx` y error #19.

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
| Cambiar sincronización de Checkins (Apps Script → Supabase) | [SyncCheckins.gs](SyncCheckins.gs), Sheets `Checkin_Limpieza_Normal`, `Checkin_Limpieza_Inicial`, `Checkin_Manitas` |
| Cambiar gestión de usuarios (perfiles, roles, email sync) | [src/pages/GestionUsuarios.tsx](src/pages/GestionUsuarios.tsx), [src/services/api.ts](src/services/api.ts) (`getAllUsers`, `updateProfile`) |
| Cambiar Cleans (limpiezas normales/iniciales/manitas) | [src/pages/Cleans.tsx](src/pages/Cleans.tsx), [src/services/api.ts](src/services/api.ts) (`getCleans`, `createClean`, etc) |
| Cambiar Workers (trabajadores, salarios, perfiles) | [src/pages/Workers.tsx](src/pages/Workers.tsx), [src/services/api.ts](src/services/api.ts) (`getWorkers`, `getWorkerByPhone`, etc) |

## Notas

- `.idea/` y `node_modules/` ignorados.
- Hay múltiples `supabase_migration*.sql` versionados — aplicarlas en orden si se monta un entorno nuevo (revisar ej. v14: hora Madrid, v16: FKs, v17: admin_delete_user).
- `index.html` carga la app; Vite sirve en puerto 5174 por defecto.
- **Env vars requeridas**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLEANS_SPREADSHEET_ID` (Sheets de Checkins), `VITE_CLEANS_APPS_SCRIPT_URL` (deleteCheckinRecord).
- **Env vars legacy** (a retirar cuando las migraciones se confirmen): `VITE_GOOGLE_API_KEY` (only if Sheets migration still runs), `VITE_INCIDENCIAS_SPREADSHEET_ID`, `VITE_ENTREGA_LLAVES_SPREADSHEET_ID`, `VITE_SUGERENCIAS_APPS_SCRIPT_URL`.
- **Documentación de bugs y soluciones**: Ver `docs/errores_conocidos.md` para patrones a evitar (N+1 queries, Apps Script fallbacks, async error handling, etc).
- **Session storage sin Web Lock**: Login usa fetch nativo a `/auth/v1/token`, tokens en `memStore` (Map sincrónico). No persiste entre recargas (por diseño).
