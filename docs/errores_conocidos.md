# Registro de Errores Conocidos y Resolución de Problemas

Este documento detalla los problemas técnicos recurrentes, bugs de desarrollo identificados y las correspondientes soluciones aplicadas en la plataforma **BaseDatosPagosRH**.

---

## 1. Gestión de Accesos y Sincronización de Perfiles

### Bug: Desincronización de Correo al Editar Usuarios
- **Síntoma**: Al modificar el correo de un trabajador desde la pantalla de Gestión de Usuarios (`GestionUsuarios.tsx`), el campo cambiaba en la tabla pública de la base de datos (`profiles.email`), pero la cuenta de acceso real en Supabase Auth (`auth.users`) seguía manteniendo el correo antiguo. Esto provocaba que el usuario no pudiera iniciar sesión con su nueva dirección y se crearan perfiles duplicados en la base de datos al intentar registrarlo de nuevo.
- **Causa**: Las tablas públicas de Supabase no tienen permisos directos para modificar el esquema de autenticación privado de `auth.users` a menos que se use un rol privilegiado.
- **Solución**: Se implementó una Edge Function de Supabase (`update-user-profile`) y posteriormente un procedimiento almacenado RPC en PostgreSQL (`admin_delete_user` con privilegios `SECURITY DEFINER` en la migración v17) que sincronizan ambas tablas en una transacción atómica verificando que el usuario que ejecuta el cambio posea permisos de `admin`.

---

## 2. Formularios de Trabajadores y Componentes de Interfaz

### Bug: Modales Desactualizados del Trabajador
- **Síntoma**: Los modales de reporte para el personal móvil (`ServiceFormModal.tsx`, `EntregaLlavesFormModal.tsx`, `IncidenciaFormModal.tsx`) mostraban bugs al rellenar autocompletados de alojamientos o campos numéricos, a pesar de haberse corregido previamente en el código general.
- **Causa**: Se habían duplicado componentes de entrada de datos de manera local dentro de cada uno de los archivos de modales. Al modificar los componentes maestros de ayuda, los modales seguían usando sus copias locales desactualizadas.
- **Solución**: Se centralizaron todas las primitivas y lógicas de campos en el archivo de helpers compartidos [serviceFormHelpers.tsx](file:///c:/Users/artur/Desktop/rental/BaseDatosPagosRH/BaseDatosPagosRH/src/components/workers/serviceFormHelpers.tsx). Se eliminaron las réplicas de código locales para forzar a que todos los modales importen exclusivamente del helper maestro.

---

## 3. Manejo de Fechas, Horarios y Zonas Horarias

### Bug: Desfase Horario de 1-2 Horas en Reportes Visuales
- **Síntoma**: Los administradores auditaban los partes de trabajo de la limpieza y veían horas de entrega o firmas registradas con 2 horas de diferencia (ej. una entrega a las 18:00 se visualizaba en Supabase como a las 16:00).
- **Causa**: Supabase almacena por defecto las fechas en UTC (`timestamptz`). Al renderizarse en interfaces del administrador sin conversión local explícita, se mostraba la hora con el offset UTC.
- **Solución**: Convertir los campos `created_at` y `updated_at` de las tablas transaccionales a tipo `timestamp(0)` sin zona horaria, calculando el valor por defecto directamente en el huso de España mediante `now() AT TIME ZONE 'Europe/Madrid'` (ver Migraciones v14 y v15).

---

## 4. Validaciones de Base de Datos y Formatos de Entrada

### Bug: Transacción Fallida al Enviar Reportes con Bizum
- **Síntoma**: El formulario de Entrega de Llaves devolvía un error de base de datos genérico al intentar enviar un reporte en el cual se había introducido una fianza por Bizum.
- **Causa**: Para facilitar el rellenado visual del operario en pantallas táctiles de móvil, el input permite escribir el número con espacios separadores (`612 34 56 78`). Sin embargo, en PostgreSQL, la tabla `key_deliveries` tiene una restricción de integridad `CHECK (bizum_monto ~ '^[0-9]+$')` que rechaza cualquier carácter no numérico, incluyendo espacios en blanco.
- **Solución**: Se mantiene el formateador visual de cara al usuario, pero se aplica la función de limpieza `stripBizum(v)` (`(v ?? '').replace(/\D/g, '')`) en [reportsApi.ts](file:///c:/Users/artur/Desktop/rental/BaseDatosPagosRH/BaseDatosPagosRH/src/services/reportsApi.ts) antes de enviar el payload para purgar cualquier carácter no numérico antes de la inserción SQL.

---

## 5. Permisos de RLS (Row Level Security)

### Bug: Registro Silencioso de Conexión Fallido (`last_seen`)
- **Síntoma**: El sistema intenta registrar de forma automática la última fecha de conexión de los trabajadores al abrir el panel (`last_seen`). Las peticiones fallaban de forma silenciosa con errores 403 de seguridad en la consola del navegador.
- **Causa**: La política RLS establecida en la tabla `profiles` no autorizaba la actualización de datos a usuarios sin privilegios administrativos sobre su propia fila.
- **Solución**: Se añadió en la migración v7 una política RLS específica que autoriza los accesos de actualización sobre el perfil del propio usuario autenticado:
  ```sql
  CREATE POLICY "Permitir a usuarios actualizar su propio perfil" 
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  ```

---

## 6. Eliminación de Usuarios y Restricciones de Clave Foránea

### Bug: Error de Clave Foránea al Eliminar Usuarios (Postgres Error 23503)
- **Síntoma**: Al eliminar a un trabajador o administrador, la base de datos de Supabase abortaba la acción y devolvía un error por violación de restricciones de llave foránea.
- **Causa**: Al intentar borrar al usuario de la tabla de autenticación, la fila correspondiente en `profiles` quedaba huérfana y bloqueaba el borrado por integridad. Asimismo, en la tabla de `workers`, el campo `profile_id` seguía apuntando a un identificador que ya no existía.
- **Solución**: Se aplicó la migración v16 que reestructura las restricciones de clave ajena:
  - `profiles.id` $\rightarrow$ `auth.users.id` configurado con `ON DELETE CASCADE` (si se borra el usuario, se limpia su perfil automáticamente).
  - `workers.profile_id` $\rightarrow$ `profiles.id` configurado con `ON DELETE SET NULL` (si se borra el perfil, el trabajador queda liberado y disponible para asignarle un nuevo usuario sin romper la integridad).

---

## 7. Login Congelado / Verificando... Infinito al Cambiar de Usuario

- **Síntoma**: Tras cerrar sesión, al intentar iniciar sesión con otro usuario, el botón muestra "Verificando…" indefinidamente sin entrar nunca, o bien redirige automáticamente al usuario anterior.
- **Causa raíz**: `supabase.auth.signInWithPassword()` nunca resuelve su promesa. El SDK de Supabase JS v2 usa el Web Lock API (`navigator.locks`) para serializar operaciones de auth. Cuando `detectSessionInUrl` y `getSession()` están activos al mismo tiempo que `signInWithPassword`, los tres compiten por el mismo lock → deadlock → la promesa JS nunca resuelve. El lock de `signOut()` también puede colgar (1500ms race), dejando el token anterior en storage → Login detecta sesión vieja → auto-login con el usuario anterior.
- **Solución aplicada (2026-06-23)**:
  1. **Storage en memoria** (`memStore`, Map sincrónico) en `supabaseClient.ts` reemplaza `sessionStorage`. El SDK nunca accede a Web Storage del navegador, eliminando la contención con otros tabs/frames.
  2. **Login via fetch nativo** en `appsScriptApi.login()`: en vez de `signInWithPassword()`, se llama directamente a `POST /auth/v1/token?grant_type=password`. Los tokens se escriben en `memStore` con la clave `sb-{ref}-auth-token`. El SDK los encuentra en el próximo `getSession()` de forma sincrónica (sin red).
  3. **Perfil via fetch nativo**: `GET /rest/v1/profiles` con `Authorization: Bearer {token}` evita que `.from('profiles')` pase por el SDK antes de que la sesión esté en memoria.
  4. **Logout limpio**: `handleLogout` en `App.tsx` llama a `memStore.clear()` + limpia `sb-*` de sessionStorage/localStorage + race timeout de 1500ms en `signOut`.

---

## 10. GestionUsuarios muestra "0 de 0 usuarios" aunque la API devuelve datos

- **Síntoma**: La página `/usuarios` muestra "Sin resultados / 0 de 0 usuarios" aunque la pestaña Network confirma que `profiles?select=*` retorna 200 con datos reales.
- **Causa**: `loadUsers()` en `GestionUsuarios.tsx` hacía `u.name.split(' ')` directamente. Si cualquier perfil en Supabase tiene `full_name = null`, `u.name` es `undefined` y `.split()` lanza `TypeError`. El bloque `try` no tenía `catch`, por lo que el error se propagaba silenciosamente, `setUsers` nunca se ejecutaba y `users` quedaba `[]`. También el spinner desaparecía (el `finally` sí corría) haciendo creer que había cargado correctamente con cero usuarios.
- **Solución**: Cambiado `u.name.split(...)` por `(u.name || '?').split(...).filter(Boolean)...` para tolerar perfiles sin nombre. Añadido bloque `catch` que loguea el error con `console.error` para que futuros fallos sean visibles en la consola.
- **Regla para el futuro**: **Todo `async` que actualiza estado debe tener `catch` explícito.** Un `try/finally` sin `catch` oculta errores de mapeo/parsing y hace que la UI muestre vacío sin ninguna pista en consola.

---

## 9. Peticiones Duplicadas y Lentitud General del Dashboard

- **Síntoma**: El dashboard tarda en mostrar datos. En la pestaña Network se observan 4+ llamadas duplicadas a `incidencias_logistica`, `entrega_llaves_logistica` y `worker_accommodations`. Ocasionalmente aparecen llamadas lentas a Google Apps Script (`Informe_Incidencia`) aunque la migración debería estar completada.
- **Causa 1 — N+1 en `getWorkers()`**: La función `getWorkers()` en `api.ts` primero carga la tabla `workers` + `worker_sensitive_data` + `worker_accommodations`, y luego internamente llama a `getNormalCleans()`, `getInitialCleans()`, `getHandymanRecords()` y `getEntregaLlaves()` para calcular los earnings. Dashboard.tsx a su vez llama a esas mismas cuatro funciones directamente en su `Promise.all`. Aunque `withSheetsCache` deduplica las peticiones en vuelo, sigue habiendo N llamadas redundantes.
- **Causa 2 — count check de migración en cada montaje**: `migrateIncidenciasFromSheets()` y `migrateEntregaLlavesFromSheets()` hacen un `SELECT count` a Supabase cada vez que se monta `Incidencias.tsx` o `EntregaDeLlaves.tsx`. Si el count devuelve `null` por un error de red o RLS, la función cae al Apps Script (llamada lenta de 300-600 ms a Google Sheets) aunque los datos ya existan.
- **Solución aplicada**: Se añadió un `Set` a nivel de módulo (`_migrationsConfirmed`) en `api.ts`. La primera vez que el count confirma que hay datos, se registra en el Set y todas las llamadas siguientes de esa sesión retornan `{skipped:true}` en O(1) sin tocar la red. El fall-through al Apps Script solo ocurre si el count devuelve 0 genuino (tabla vacía), nunca por un null/error.
- **Regla para el futuro**: **No llamar a Apps Script como fallback de un error de Supabase.** Si Supabase falla, lanzar error o devolver array vacío. El Apps Script es solo para migración única de datos históricos.

---

## 11. WorkerPanel no carga datos / "Todavía no has realizado ningún trabajo" (2026-06-25)

- **Síntoma**: El panel del trabajador muestra el skeleton indefinidamente o "Todavía no has realizado ningún trabajo" aunque el trabajador tiene registros en `service_reports`. Se reproducía al entrar por primera vez o tras F5.
- **Causa 1 — `getUser()` falla en SDK frío**: `getCurrentWorkerId()` y `getMyWorker()` en `reportsApi.ts` usaban `supabase.auth.getUser()`, que hace una llamada de red a `/auth/v1/user` para validar el token. Si el SDK se inicializa frío (sin `_currentSession` en memoria), la llamada falla o devuelve error → `workerId = null` → `listMyServiceReports()` retorna `[]` sin error visible.
- **Causa 2 — memStore vacío tras F5**: `supabaseClient.ts` usaba un `Map` en memoria puro. Al recargar la página el Map se vaciaba → el SDK no tenía token → `getUser()` fallaba → mismo síntoma.
- **Causa 3 — backfill avatar_url causaba 406**: `App.tsx` tenía un `useEffect` que hacía `supabase.from('profiles').select('avatar_url')` cuando `user.avatar_url === undefined`. Sin token válido en memStore, la query retornaba 406 Not Acceptable, llenando la consola de errores y enmascarando el problema real.
- **Solución aplicada**:
  1. `supabaseClient.ts`: `memStorage` ahora hace backup en `sessionStorage`. En `getItem`, si memStore no tiene la clave, lee de `sessionStorage` y restaura en memStore. En `setItem`/`removeItem` sincroniza ambos. Así el token sobrevive F5 sin volver a usar la API de locks del SDK.
  2. `reportsApi.ts`: `getCurrentWorkerId()` y `getMyWorker()` cambiados a `supabase.auth.getSession()` (lee de storage, sin red) en vez de `getUser()` (hace red). Más robusto ante SDK recién inicializado.
  3. `App.tsx`: eliminado el `useEffect` de backfill de `avatar_url`. Con `memStore` no hay "sesiones viejas sin avatar_url" que backfillciar; el login ya siempre incluye `avatar_url`.
- **Regla para el futuro**: **Usar `getSession()` en lugar de `getUser()` cuando solo se necesita el UID del usuario.** `getUser()` valida el token en red; `getSession()` lo lee de storage. Si la validación en servidor es necesaria (seguridad), usar `getUser()` solo en paths críticos (admin actions), no en cada carga de datos.

---

## 13. getWorkers() 3ª ola secuencial bloqueaba carga del Dashboard (2026-06-26)

- **Síntoma**: Dashboard lento (2-4 s) aunque Supabase respondía rápido. Vercel mostraba la misma lentitud.
- **Causa**: `getWorkers()` en `api.ts` ejecutaba las llamadas en 3 olas secuenciales: (1) workers, (2) sensitive_data + accommodations, (3) cleans×3 + entrega_llaves. La 3ª ola empezaba solo cuando la 2ª terminaba, sumando una ronda de red extra.
- **Solución**: Lanzar `derivedDataPromise = Promise.all([getNormalCleans, getInitialCleans, getHandymanRecords, getEntregaLlaves])` al inicio de `getWorkers()`, antes de la query de workers. Cuando llega la 2ª ola, el 3er grupo ya lleva una ronda completa en vuelo → se recoge con `await derivedDataPromise` sin esperar.
- **Regla**: En funciones que hacen múltiples rondas de red independientes, lanzar todos los `Promise.all` al inicio aunque no se necesiten inmediatamente. La espera es gratis si el procesamiento intermedio tarda más que la red.
- **Commit**: `fe4e429` — función en `src/services/api.ts`.

---

## 14. Dev server arrancaba con .env desactualizado (2026-06-26)

- **Síntoma**: Login en local no conectaba a Supabase (cero hits en auth logs), aunque las variables en `.env` eran correctas.
- **Causa**: Vite lee el `.env` solo al arrancar el servidor. Si se edita el archivo después de `npm run dev`, el proceso sigue usando las variables antiguas.
- **Solución**: Matar el proceso de Vite y relanzar `npm run dev` siempre que se modifique `.env`.
- **Regla**: Si las llamadas de red desde local dan 400/401 pero las variables `.env` parecen correctas, comprobar el mtime del `.env` vs la hora de inicio del servidor (`ps aux | grep vite`). Si `.env` es más nuevo, reiniciar.

---

## 12. Delays artificiales bloqueaban el Dashboard (2026-06-25)

- **Síntoma**: El dashboard tardaba 2-3 segundos en cargar datos tras cambiar de usuario o tras F5, incluso con Supabase respondiendo rápido.
- **Causa**: Restos de simulación de Apps Script — `await delay(X)` en funciones de `api.ts` (`getPagos`, `getAllPagos`, `getWorkerPagos`, `getAnalytics`, etc.). Estos delays sumaban 2.5+ segundos y bloqueaban el `Promise.all` del Dashboard entero.
- **Solución**: Eliminados todos los `await delay()` en `api.ts`. La función `delay` queda definida pero sin uso.
- **Regla para el futuro**: Al migrar una función de Apps Script a Supabase, revisar si tiene `await delay()` residual y eliminarlo.

---

## 15. WorkerPanel vacío + Dashboard spinner infinito tras login (2026-06-26)

- **Síntoma 1**: Al hacer login como trabajador, WorkerPanel muestra skeletons vacíos. Si se recarga, los datos aparecen.
- **Síntoma 2**: Al hacer login como admin (segunda sesión tras trabajador), Dashboard muestra spinner infinito. Si se recarga, carga bien.
- **Causa**: El SDK de Supabase cachea la sesión en `_currentSession` (estado interno del objeto). Escribir el token en `memStore` actualiza el storage, pero no `_currentSession`. Las queries RLS del SDK leen el `Authorization` header de `_currentSession`, no del storage — si `_currentSession` es null, el header va vacío → RLS devuelve `[]` silencioso (error #5 pattern) → UI vacía sin error.
- **Por qué al recargar funciona**: F5 reinicia el SDK desde cero, que inicializa `_currentSession` leyendo memStorage (que lee memStore → sessionStorage fallback) → token encontrado → todo OK.
- **Solución aplicada**:
  1. `api.ts` `login()`: llamar `await supabase.auth.setSession({ access_token, refresh_token })` después de escribir en memStore. `setSession()` actualiza `_currentSession` directamente. No hace red adicional porque el SDK tiene `lock: async fn => fn()` (sin Web Lock) y los tokens son frescos.
  2. `reportsApi.ts`: `getCurrentWorkerId()` y `getMyWorker()` usan `getSessionFromStore()` (nueva helper en `supabaseClient.ts`) que lee memStore/sessionStorage directamente, sin pasar por el SDK — inmune a `_currentSession` null.
  3. `supabaseClient.ts`: exportar `getSessionFromStore()` que parsea el JSON del token directamente desde memStore/sessionStorage.
- **Regla para el futuro**: Escribir en `memStore` no es suficiente. Siempre llamar `supabase.auth.setSession()` después del login para sincronizar `_currentSession`. Sin eso, las queries RLS del SDK salen sin token aunque memStore lo tenga.
- **Fix adicional — WorkerSwipeShell lazy-mount** (commit `fd5689d`): WorkerSwipeShell montaba los 3 panes (WorkerPanel + WorkerRecords + Profile) simultáneamente al entrar, lo que disparaba ~14 llamadas a `getCurrentWorkerId` en paralelo. Tras el lazy-mount (`visited` Set, pane solo se monta al visitarse por primera vez), baja a ~8 llamadas (solo el pane activo). Admin Dashboard ya no queda en spinner después del cambio de sesión.
- **Estado final**: Confirmado funcionando. Admin carga sin spinner tras login desde sesión trabajador. WorkerPanel carga datos en primera visita sin recargar.
- **Commits**: `7c445c6`, `fd5689d`.

---

## 8. Migración de Apps Script a Supabase (2026-06-23)

- **Decisión**: Migración total del backend de Google Apps Script (Sheets) a Supabase.
- **Tablas creadas**: `cleans`, `suggestions`, `entrega_llaves_logistica`, `incidencias_logistica`. Bucket `pdfs` en Storage.
- **Funciones eliminadas de Apps Script**: workers, cleans, sugerencias, feedback, entrega de llaves logística, incidencias logística, upload PDF, getAllUsers fallback, syncWorkersFromSheets, syncAccommodationsFromSheets.
- **Sigue en Sheets** (a propósito): `getNormalCheckins`, `getInitialCheckins`, `getHandymanCheckins`, `deleteCheckinRecord` — alimentados por reservas externas, no controladas por la app. También las funciones de migración única (`migrateIncidenciasFromSheets`, `migrateEntregaLlavesFromSheets`) que se autodesactivan tras la primera ejecución.
- **Variables de entorno a retirar** cuando las migraciones únicas confirmen haber corrido: `VITE_INCIDENCIAS_SPREADSHEET_ID`, `VITE_ENTREGA_LLAVES_SPREADSHEET_ID`, `VITE_SUGERENCIAS_APPS_SCRIPT_URL`.
