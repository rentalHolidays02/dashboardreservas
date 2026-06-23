# Flujo de Trabajo (Workflow)

Este documento describe los flujos de trabajo operativos tanto para desarrolladores como para el personal administrativo y los trabajadores que utilizan la plataforma **BaseDatosPagosRH**.

---

## 1. Flujo de Trabajo del Desarrollador (Setup y Ciclo de Vida)

### A. Preparación del Entorno
1. **Instalación de Dependencias**: Clonar el repositorio y ejecutar:
   ```bash
   npm install
   ```
2. **Configuración de Variables de Entorno**: Crear un archivo `.env` en la raíz basándose en `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anonima-de-supabase
   VITE_APP_SCRIPT_URL=https://script.google.com/macros/s/tu-id-web-app/exec
   ```
3. **Servidor Local**: Arrancar el servidor de desarrollo Vite en [http://localhost:5173](http://localhost:5173):
   ```bash
   npm run dev
   ```

### B. Aplicación de Cambios en Base de Datos (Supabase)
Las modificaciones en el esquema SQL se realizan de forma incremental mediante archivos numerados en la raíz. Si montas una base de datos nueva o actualizas una existente:
1. Copia y ejecuta los scripts en orden en el **SQL Editor de Supabase**:
   `supabase_migration.sql` $\rightarrow$ `supabase_migration_v2.sql` $\rightarrow$ ... $\rightarrow$ `supabase_migration_v17.sql`.
2. Las políticas RLS y triggers de fecha de Madrid (`Europe/Madrid`) se inicializan automáticamente con estas migraciones.

### C. Despliegue a Producción
La aplicación está configurada para desplegarse mediante **Vercel** o utilizando el script local `deploy.ps1` en PowerShell:
- Ejecutar el script `deploy.ps1` para compilar el código TypeScript y empaquetar los estáticos en la carpeta `dist`.
- Sincronizar las variables de entorno de producción utilizando `setup-vercel-env.ps1`.

---

## 2. Flujo de Trabajo del Trabajador (Operación Móvil)

El operario de limpieza o el manitas sigue un proceso lineal desde su dispositivo móvil:

```mermaid
seqdiagram
    Trabajador ->> WorkerPanel: Inicia sesión / Accede al Panel Móvil
    WorkerPanel ->> Formulario: Abre reporte (Servicio, Llaves o Incidencia)
    alt Edición en progreso (Pérdida de red o cierre accidental)
        Formulario ->> LocalStorage: Guardado automático en localStorage
    else Guardado manual a medias
        Formulario ->> Supabase: Guarda en "report_drafts" (borrador en nube)
    end
    Trabajador ->> Formulario: Captura coordenadas GPS + Firmas electrónicas
    Trabajador ->> Formulario: Presiona "Enviar reporte"
    Formulario ->> Supabase: Inserta en tablas correspondientes (service_reports, etc.)
    Formulario ->> AppsScript: Envía payload (sincroniza en Google Sheets)
    Formulario ->> Supabase: Limpia borradores (de la nube y de localStorage)
    Formulario ->> WorkerPanel: Suma tarifas del parte al saldo acumulado del trabajador
```

### Pasos detallados:
1. **Acceso**: El trabajador inicia sesión mediante su Magic Link de Supabase o email/contraseña.
2. **Entrada al panel móvil (`WorkerPanel.tsx`)**: Visualiza sus tareas activas, su historial reciente y su sección de "Mis borradores".
3. **Completado de reportes**:
   - **Parte de Servicio (Limpieza o Manitas)**: Registra hora de entrada, salida, kilómetros recorridos y notas.
   - **Entrega de Llaves**: Registra datos del cliente turístic, fianza, cobros adicionales, kilometraje y captura la firma del trabajador y del huésped en pantalla.
   - **Reporte de Incidencia**: Detalla desperfectos técnicos en el alojamiento, duración estimada de la reparación y notas.
4. **Respaldos (Borradores)**:
   - Si interrumpe el parte, puede presionar "Guardar en borrador" para persistirlo en la nube (`report_drafts`).
   - Si cierra la pestaña del navegador sin querer, la capa de `localDrafts` lo restaura automáticamente de su memoria local.
5. **Envío y Sincronización**: Al presionar "Enviar", el sistema inserta el registro en Supabase, sube las firmas digitales al storage, limpia borradores, suma las comisiones ganadas a su saldo y replica la transacción en el Excel de Google Sheets mediante el endpoint de Apps Script.

---

## 3. Flujo de Trabajo del Administrador (Consola de Oficina)

El personal administrativo gestiona la logística diaria desde su ordenador de escritorio:

### A. Gestión de Accesos (`GestionUsuarios.tsx` & `Profile.tsx`)
- Registra cuentas para nuevos miembros del equipo directivo o de operaciones.
- Define el Rol (`admin`, `editor`, `viewer`, `trabajador`).
- Sincroniza correos electrónicos modificados utilizando el RPC o la Edge Function para evitar cuentas huérfanas en Supabase Auth.

### B. Mapeo de Alojamientos y Tarifas (`Alojamientos.tsx` & `Workers.tsx`)
- Registra cada propiedad especificando sus coordenadas visuales sobre el mapa interactivo (Leaflet).
- Asigna qué limpiadores operan habitualmente cada apartamento y fija los precios específicos de limpieza y toallas/sábanas en la tabla pivote de asignaciones.

### C. Auditoría y Liquidación Financiera (`Pagos.tsx` & `ServiciosDB.tsx`)
- Revisa semanal o mensualmente los reportes enviados por el equipo de limpieza.
- En la base de datos de servicios (`ServiciosDB.tsx`), el administrador puede hacer clic sobre los reportes vinculados para ver detalles específicos de llaves o incidencias en un popup dinámico.
- Consulta el balance acumulado devengado por cada trabajador. Tras efectuar la transferencia bancaria o el Bizum correspondiente de la nómina, presiona "Marcar como pagado", lo cual resetea el saldo pendiente del empleado a 0 en Supabase.

### D. Generación de Informes de Rendimiento (`GenerarInforme.tsx`)
- Accede al panel de generación de informes.
- Filtra por periodo temporal, alojamiento y trabajadores.
- Descarga un informe en PDF con tablas detalladas y un resumen agregador de KPIs.
- La metadata e historial de los informes generados se guarda automáticamente en `report_history`.
- Consulta sugerencias y reportes de fallos de la aplicación en la pestaña de feedback (`Sugerencias.tsx`), pudiendo responder correos directamente al remitente a través del proxy de Gmail de Apps Script.
