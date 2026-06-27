# Registro de Decisiones de Arquitectura (ADR)

Este documento recopila las decisiones de diseño de software y arquitectura técnica adoptadas en el proyecto **BaseDatosPagosRH**, detallando el contexto, las alternativas evaluadas y las consecuencias de cada decisión.

---

## Decisiones Técnicas Clave

### ADR 1: Persistencia Híbrida (Google Sheets + Supabase)
- **Estado**: Aceptado.
- **Contexto**: La empresa requiere la flexibilidad de Google Sheets para que el personal de oficina (no técnico) pueda visualizar, exportar y ajustar las nóminas y registros de manera manual. Sin embargo, se necesitan funciones avanzadas como autenticación segura de empleados, almacenamiento de firmas digitales en pantalla, gestión de fotos, control de incidencias con adjuntos y un sistema móvil fiable para partes de trabajo.
- **Decisión**: Mantener **Google Sheets** como repositorio primario para administración general (limpiezas, nóminas acumuladas, registros de llaves generales) y acoplarlo con **Supabase** (PostgreSQL, Storage y Auth) para la capa del trabajador (partes diarios, incidencias en curso, firmas de huéspedes, fotos y control de sesiones).
- **Consecuencias**:
  - *Ventaja*: El equipo administrativo sigue utilizando su flujo habitual en Excel/Sheets.
  - *Ventaja*: Seguridad robusta de datos en el cliente móvil y gestión óptima de archivos binarios (firmas y fotos).
  - *Desventaja*: Es necesario mantener sincronizadas ambas bases de datos al momento de confirmar un reporte.

---

### ADR 2: Proxy de Google Apps Script para el acceso a Sheets
- **Estado**: Aceptado.
- **Contexto**: Realizar peticiones directas desde React usando la API de Google Sheets requiere inyectar claves de API o tokens OAuth del lado del cliente, lo que compromete la seguridad del archivo y de la organización.
- **Decisión**: Exponer los datos de Google Sheets a través de una API Web creada con **Google Apps Script** que actúa como proxy intermediario.
- **Consecuencias**:
  - *Ventaja*: React no almacena tokens sensibles; toda la lógica de autenticación de Google se delega al servidor de Google Apps Script.
  - *Ventaja*: Permite procesar datos y formatearlos en un JSON simplificado antes de enviarlos a la aplicación.
  - *Desventaja*: Introduce una pequeña latencia adicional al depender del tiempo de arranque del Web App de Apps Script.

---

### ADR 3: Uso de marcas de tiempo en Hora Local de Madrid (`timestamp(0)`)
- **Estado**: Aceptado (Migraciones v14 y v15).
- **Contexto**: Las bases de datos tradicionales en Supabase usan el tipo `timestamptz` (UTC). Al generar reportes desde España y visualizar la base de datos en el panel de control de Supabase Studio o exportar listados, las marcas de tiempo aparecían desplazadas (1 hora en invierno, 2 horas en verano debido al huso CEST). Esto generaba confusión en las auditorías administrativas.
- **Decisión**: Convertir los campos `created_at` y `updated_at` de las tablas transaccionales de trabajadores (`service_reports`, `key_deliveries`, `incident_reports`) al tipo `timestamp(0)` sin zona horaria, calculando el valor por defecto directamente en el huso de España mediante la instrucción SQL `now() AT TIME ZONE 'Europe/Madrid'`.
- **Consecuencias**:
  - *Ventaja*: Los datos representados en los listados del administrador coinciden exactamente con la hora civil local española del reporte.
  - *Ventaja*: Se elimina el milisegundo de las marcas temporales, reduciendo el ruido visual en logs.
  - *Desventaja*: Si la empresa expande operaciones a otras zonas horarias fuera de Europa Occidental, estas tablas requerirán conversiones explícitas de hora local.

---

### ADR 4: Duraciones y Tiempos de Entrada/Salida como Cadenas `text` (`HH:MM`)
- **Estado**: Aceptado.
- **Contexto**: El almacenamiento de tiempos transcurridos (por ejemplo, duración de incidencias u horas extra) usando tipos nativos como `interval` o `time` en PostgreSQL produce desajustes en el formato JS al realizar sumas matemáticas y formatear la salida en pantalla.
- **Decisión**: Registrar las horas de entrada/salida y las duraciones como textos formateados en `HH:MM` (ej. `"08:30"`, `"01:15"`), restringidos por restricciones CHECK de expresiones regulares en base de datos.
- **Consecuencias**:
  - *Ventaja*: Inmunidad frente a desajustes por zonas horarias al serializar o deserializar en JSON.
  - *Ventaja*: Operaciones de visualización directa y filtros simples en React sin requerir librerías pesadas de parsing de fechas (como moment o date-fns).
  - *Desventaja*: Las sumas acumuladas de horas de trabajo en PostgreSQL requieren la creación de funciones auxiliares que conviertan las cadenas de texto a minutos y de vuelta a formato de tiempo.

---

### ADR 5: Esquema de Borradores en Dos Capas (Local + Remoto)
- **Estado**: Aceptado.
- **Contexto**: El personal operativo suele reportar desde áreas con baja cobertura de datos móvil (ascensores, sótanos o parkings de apartamentos). Si se pierde la conexión o el dispositivo se apaga, el trabajador perdía los datos de un parte a medio rellenar, teniendo que duplicar esfuerzos.
- **Decisión**: Diseñar una persistencia en dos niveles:
  1. **localStorage**: Guarda en el navegador local el estado actual del formulario ante cualquier cierre fortuito o accidental de la ventana.
  2. **report_drafts (Supabase)**: Al pulsar "Guardar en borrador", se realiza un envío seguro a una tabla relacional en Supabase.
- **Consecuencias**:
  - *Ventaja*: Permite al trabajador continuar un parte desde un dispositivo diferente si es necesario (ya que el borrador en la nube está asociado a su perfil).
  - *Ventaja*: Las firmas electrónicas en base64 se omiten de la serialización del borrador para mantener el tamaño del payload bajo y evitar consumir el límite de almacenamiento o timeout de red.

---

### ADR 6: Borrado Directo de Usuarios mediante RPC SQL (`admin_delete_user`)
- **Estado**: Aceptado (Migración v17).
- **Contexto**: Borrar a un usuario del panel de administración requería invocar una Edge Function en Deno que desvinculara la cuenta. Si la Edge Function fallaba o no estaba activa, el usuario no se eliminaba, dejando perfiles huérfanos.
- **Decisión**: Implementar un procedimiento almacenado en PostgreSQL (`admin_delete_user`) configurado con `SECURITY DEFINER` que se ejecuta con privilegios de superusuario para eliminar directamente registros de la tabla interna `auth.users`, restringido por una comprobación en la que el usuario que lo invoca debe ser de rol `admin`.
- **Consecuencias**:
  - *Ventaja*: Mayor fiabilidad al eliminar usuarios del panel sin depender de infraestructura externa de Edge Functions.
  - *Ventaja*: Activación automática de la limpieza en cascada sobre las tablas `profiles` y liberación del campo `profile_id` en `workers` para su posterior reasignación.

---

### ADR 8: Login via Fetch Nativo (bypass del SDK de Supabase Auth)
- **Estado**: Aceptado (2026-06-23).
- **Contexto**: `supabase.auth.signInWithPassword()` y `setSession()` cuelgan indefinidamente en el navegador porque el SDK usa `navigator.locks` internamente y `detectSessionInUrl` + `getSession()` concurrentes provocan un deadlock. El síntoma era el botón "Verificando…" infinito, reproducible cada vez que se cambiaba de usuario.
- **Decisión**: Reemplazar todo el flujo de autenticación del SDK por llamadas `fetch` nativas al REST de Supabase (`/auth/v1/token` y `/rest/v1/profiles`). Los tokens se inyectan directamente en un `Map` en memoria (`memStore` en `supabaseClient.ts`) que se usa como `storage` del cliente Supabase. Esto elimina la dependencia del Web Lock API para el login y permite al SDK leer la sesión síncronamente sin red en los `.from()` posteriores.
- **Consecuencias**:
  - *Ventaja*: Login siempre resuelve, sin timeouts ni deadlocks.
  - *Ventaja*: Dashboard carga inmediatamente tras login porque `getSession()` del SDK lee del Map en O(1).
  - *Ventaja*: Logout limpio: `memStore.clear()` borra la sesión al instante.
  - *Desventaja*: La sesión no persiste entre recargas de página (como sessionStorage, pero sin el riesgo de locks). El usuario tiene que volver a iniciar sesión si recarga.
  - *Archivos*: `src/services/supabaseClient.ts` (memStore + memStorage), `src/services/api.ts` (login fetch), `src/App.tsx` (logout memStore.clear).

---

### ADR 9: memStorage con backup en sessionStorage (2026-06-25)
- **Estado**: Aceptado.
- **Contexto**: `memStore` (Map en memoria) se vaciaba al hacer F5, perdiendo el token de Supabase. El SDK inicializaba frío y `auth.getUser()` fallaba → WorkerPanel mostraba vacío. No se podía usar el storage nativo del SDK por el deadlock de Web Locks (ver ADR 8).
- **Decisión**: Modificar `memStorage` en `supabaseClient.ts` para que `setItem`/`removeItem` sincronicen también con `sessionStorage`, y `getItem` lea de `sessionStorage` como fallback si memStore no tiene la clave. Esto preserva el token entre recargas sin volver a depender de la API de locks del SDK.
- **Consecuencias**:
  - *Ventaja*: Sesión sobrevive F5 — WorkerPanel carga datos correctamente al recargar.
  - *Ventaja*: Logout sigue limpiando ambos (`App.tsx` ya borraba `sb-*` de sessionStorage).
  - *Nota*: El token sigue siendo por pestaña (sessionStorage), no global (localStorage). Dos pestañas con distinto usuario siguen siendo independientes.
  - *Archivos*: `src/services/supabaseClient.ts`.

---

### ADR 10: getSession() en lugar de getUser() en reportsApi (2026-06-25)
- **Estado**: Aceptado.
- **Contexto**: `getCurrentWorkerId()` y `getMyWorker()` usaban `supabase.auth.getUser()` que hace una llamada de red para validar el token. Si el SDK inicializa frío (sin `_currentSession`), la llamada falla aunque el token esté en storage → WorkerPanel retorna vacío sin error visible.
- **Decisión**: Cambiar a `supabase.auth.getSession()` que lee el token de storage de forma síncrona (con fallback a sessionStorage via ADR 9). Solo usar `getUser()` donde se requiera validación real del token en servidor (paths de seguridad crítica).
- **Consecuencias**:
  - *Ventaja*: WorkerPanel carga datos correctamente tanto en primera visita como tras F5.
  - *Desventaja menor*: `getSession()` puede devolver una sesión expirada si el auto-refresh no ha corrido aún. En este contexto (cargar datos del propio trabajador) es aceptable — el query de Supabase fallará con 401 si el token expiró, lo cual es manejable.
  - *Archivos*: `src/services/reportsApi.ts`.

---

### ADR 11: getWorkers() lanza cleans/entregas en paralelo desde el inicio (2026-06-26)
- **Estado**: Aceptado.
- **Contexto**: `getWorkers()` calculaba earnings de cada trabajador cruzando cleans y entregas. Estas llamadas se lanzaban en la 3ª ola, después de cargar workers y sensitive_data, sumando una ronda de red secuencial innecesaria.
- **Decisión**: `derivedDataPromise = Promise.all([...])` se lanza al inicio de `getWorkers()`, antes de cualquier query a Supabase. Se consume con `await derivedDataPromise` cuando se necesita, pero ya lleva una o dos rondas completas en vuelo para ese momento.
- **Consecuencias**:
  - *Ventaja*: Elimina una ronda de red secuencial → Dashboard carga ~1-2 s más rápido en producción.
  - *Ventaja*: Zero cambio en la API pública de `getWorkers()`.
  - *Archivos*: `src/services/api.ts` (commit `fe4e429`).

---

### ADR 12: getSessionFromStore() — leer token directo de memStore sin pasar por SDK (2026-06-26)
- **Estado**: Aceptado.
- **Contexto**: El SDK de Supabase cachea la sesión en `_currentSession`. Escribir en memStore actualiza el storage pero no `_currentSession`. `getCurrentWorkerId()` y `getMyWorker()` llamaban a `supabase.auth.getSession()` que devuelve `_currentSession` — null hasta que alguien lo inicialice. Resultado: WorkerPanel vacío en primera carga tras login.
- **Decisión**: Exportar `getSessionFromStore()` desde `supabaseClient.ts` que parsea el JSON directamente desde memStore (con fallback a sessionStorage). Usarla en `reportsApi.ts` en lugar de `supabase.auth.getSession()`. Para las queries RLS del SDK (que sí necesitan `_currentSession`), llamar `supabase.auth.setSession()` en `login()` para sincronizarlo.
- **Consecuencias**:
  - *Ventaja*: WorkerPanel y Dashboard cargan en primera visita sin recargar.
  - *Ventaja*: `getSessionFromStore()` es O(1), sin async, sin red.
  - *Desventaja*: Añade una función helper que hay que mantener sincronizada con el formato de clave `sb-{ref}-auth-token` del SDK.
  - *Archivos*: `src/services/supabaseClient.ts`, `src/services/reportsApi.ts`, `src/services/api.ts`.

---

### ADR 13: accessToken callback en createClient para evitar initializePromise (2026-06-26)
- **Estado**: Aceptado.
- **Contexto**: ADR 12 proponía `supabase.auth.setSession()` tras el login para sincronizar `_currentSession`. En pruebas reales, `setSession()` también espera `initializePromise` internamente → cuelga igual. Resultado: login bloqueado en "Verificando..." indefinidamente. Además, `supabase.auth.getSession()` en `getAllUsers()` y `supabase.auth.onAuthStateChange` en `SetPasswordModal`/`Login.tsx` lanzaban errores en runtime con ciertas versiones del SDK.
- **Decisión**: Pasar `accessToken: async () => { ... }` en el objeto de opciones de `createClient`. Cuando está presente, el SDK llama este callback en cada query en lugar de `auth.getSession()` → bypasea `initializePromise` por completo. El callback lee de `memStore`/`sessionStorage` directamente (O(1), sin async real).
- **Efecto secundario aceptado**: `supabase.auth.onAuthStateChange`, `supabase.auth.getUser()` y `supabase.auth.getSession()` lanzan error cuando se llaman con `accessToken` option activo. Todo código que los use debe migrar a `getSessionFromStore()` o fetch directo. Afecta: `SetPasswordModal`, `Login.tsx` (flujo magic link/recovery), `api.ts getAllUsers`.
- **Consecuencias**:
  - *Ventaja*: Queries RLS nunca cuelgan. Login admin y trabajador cargan datos en primera visita sin F5.
  - *Ventaja*: Cambio de sesión entre roles (trabajador → admin) funciona sin recargar.
  - *Desventaja*: Flujos magic link y recovery pierden `onAuthStateChange` — el try/catch en Login.tsx los silencia pero no los maneja. Si se necesitan en el futuro, habrá que reimplementarlos con fetch directo a la API de Supabase.
  - *Archivos*: `src/services/supabaseClient.ts`, `src/components/auth/SetPasswordModal.tsx`, `src/pages/Login.tsx`, `src/services/api.ts` (commits `37dcd49`, `b8ec34a`).
- **Regla operativa**: antes de añadir cualquier llamada a `supabase.auth.*`, comprobar si el cliente tiene `accessToken` option activo. Si es así, usar `getSessionFromStore()` para leer la sesión y fetch directo a `/auth/v1/` para mutaciones de auth.

---

### ADR 14: Incluir firmas base64 en el payload del borrador (2026-06-26)
- **Estado**: Aceptado.
- **Contexto**: `handleSaveDraft` en `ServiceFormModal` y `EntregaLlavesFormModal` excluía las firmas (`el_firmaTrabajador`, `el_firmaHuesped`) del borrador por considerarlas "payload enorme". Al restaurar el borrador, las firmas aparecían vacías y `isValid` las exigía → formulario bloqueado sin poder enviar.
- **Decisión**: Guardar las firmas en el borrador (Supabase `report_drafts` y `localStorage`). El tamaño real de dos firmas PNG en base64 es ~50-100 KB — insignificante para el límite JSONB de Supabase (1 GB) y para localStorage (5 MB).
- **Consecuencias**:
  - *Ventaja*: Al restaurar un borrador, las firmas se muestran pre-cargadas y el trabajador puede enviar sin re-firmar.
  - *Ventaja*: `isValid` no queda bloqueado por campos vacíos al restaurar.
  - *Nota*: Si en el futuro las firmas superan 200 KB (firmas muy detalladas), considerar comprimir el canvas antes de `toDataURL` o reducir la resolución del `SignaturePad`.
- **Archivos**: `src/components/workers/ServiceFormModal.tsx`, `src/components/workers/EntregaLlavesFormModal.tsx` (commits `d74dfa1`, `c25c541`).

---

### ADR 15: TimeSelect — dos `<select>` en vez de `type="time"` (2026-06-27)
- **Estado**: Aceptado.
- **Contexto**: `<input type="time">` en iOS/Android abre el picker circular nativo de rueda — el trabajador no puede seleccionar hora en lista. No hay forma de sobrescribir este comportamiento con CSS porque es un control del SO.
- **Decisión**: Componente `TimeSelect` en `serviceFormHelpers.tsx`: dos `<select>` (hh / mm) con `selectCls` alineado visualmente con `inputCls`. Emite `"HH:MM"` — mismo formato que `type="time"` — para no romper payloads ni validaciones existentes. `maxHours` prop opcional (por defecto 23).
- **Consecuencias**:
  - *Ventaja*: Selector de lista en todos los dispositivos, sin dependencias externas.
  - *Ventaja*: Compatible con el formato `"HH:MM"` que ya usa la BD (`text CHECK regex`).
  - *Nota*: `datetime-local` (entrada/salida reserva) se mantiene nativo pero con `dateInputCls` (text-sm, px-2) para que el texto `dd/mm/aaaa hh:mm` quepa en grid de 2 columnas en móvil.
- **Archivos**: `src/components/workers/serviceFormHelpers.tsx`, `ServiceFormModal.tsx`, `IncidenciaFormModal.tsx` (commits `153cc0d`, `c936c63`).

---

### ADR 7: Migración total de Google Apps Script a Supabase
- **Estado**: Completado (2026-06-23). Excepto Checkins de limpieza.
- **Contexto**: Apps Script tenía cold starts de 3-8 segundos y escrituras fire-and-forget (`mode: 'no-cors'`) sin confirmación de éxito. La app ya tenía Supabase para auth y partes de trabajador.
- **Decisión**: Migrar todo el CRUD operativo a Supabase. Mantener Sheets solo para los Checkins de pendientes (alimentados por un sistema de reservas externo fuera del control de la app).
- **Tablas Supabase añadidas**: `cleans`, `suggestions`, `entrega_llaves_logistica`, `incidencias_logistica`. Bucket Storage `pdfs` (privado).
- **Patron de migración**: función `migrate*FromSheets()` idempotente (salta si la tabla ya tiene filas), disparada en la primera carga de cada página. Sin scripts manuales.
- **Consecuencias**:
  - *Ventaja*: Escrituras confirmadas, RLS, sin cold starts.
  - *Ventaja*: `GOOGLE_API_KEY` y demás vars de Sheets se pueden retirar del `.env` cuando las migraciones únicas confirmen haber corrido.
  - *Pendiente*: Checkins requeriría migrar también el sistema de reservas externo.
