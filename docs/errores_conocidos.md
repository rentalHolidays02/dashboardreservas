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

## 8. Migración de Apps Script a Supabase (2026-06-23)

- **Decisión**: Migración total del backend de Google Apps Script (Sheets) a Supabase.
- **Tablas creadas**: `cleans`, `suggestions`, `entrega_llaves_logistica`, `incidencias_logistica`. Bucket `pdfs` en Storage.
- **Funciones eliminadas de Apps Script**: workers, cleans, sugerencias, feedback, entrega de llaves logística, incidencias logística, upload PDF, getAllUsers fallback, syncWorkersFromSheets, syncAccommodationsFromSheets.
- **Sigue en Sheets** (a propósito): `getNormalCheckins`, `getInitialCheckins`, `getHandymanCheckins`, `deleteCheckinRecord` — alimentados por reservas externas, no controladas por la app. También las funciones de migración única (`migrateIncidenciasFromSheets`, `migrateEntregaLlavesFromSheets`) que se autodesactivan tras la primera ejecución.
- **Variables de entorno a retirar** cuando las migraciones únicas confirmen haber corrido: `VITE_INCIDENCIAS_SPREADSHEET_ID`, `VITE_ENTREGA_LLAVES_SPREADSHEET_ID`, `VITE_SUGERENCIAS_APPS_SCRIPT_URL`.
