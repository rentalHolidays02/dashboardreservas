# Convenciones de Desarrollo y Estilo de Código

Este documento establece las convenciones de diseño, desarrollo y estilo de código para garantizar la homogeneidad y mantenibilidad del repositorio **BaseDatosPagosRH**.

---

## 1. Idioma y Mensajes de Control

- **Interfaz de Usuario (UI)**: Toda la interfaz, etiquetas, mensajes de error y alertas de la aplicación deben estar en **castellano**.
- **Comentarios y Documentación**: Las explicaciones técnicas, JSDoc y comentarios en el código se escribirán en **castellano**.
- **Control de Versiones**: Los mensajes de commit de Git deben redactarse en **castellano** y describir de forma concisa el cambio (ej. `feat: añadir selector de mapa en incidencias`).

---

## 2. Desarrollo con React, TypeScript y Estilos

### A. TypeScript y React
- **Componentes**: Definir componentes funcionales mediante la sintaxis de funciones declarativas u utilizando `React.FC`.
- **Tipado Estricto**: Evitar el uso de `any`. Definir interfaces específicas para las propiedades de cada componente (`Props`) y para los objetos del modelo de datos (ver `mockData.ts` y `supabaseOperationsApi.ts`).
- **Hooks**: Centralizar los efectos y el estado local en Hooks nativos (`useState`, `useEffect`, `useMemo`, `useCallback`) o personalizados (como `useAnimatedNumber`).

### B. TailwindCSS y UI
- **Estilos inline**: Se utiliza TailwindCSS mediante clases declarativas largas aplicadas directamente sobre los elementos.
- **Paleta de Colores**:
  - Fondos y componentes neutros: Usar tonos `stone` o `slate` (ej. `bg-stone-50`, `dark:bg-stone-800/50`).
  - Color de acento de incidencias o avisos: Usar tonos `orange` (ej. `text-orange-500`, `ring-orange-500/20`).
  - Estado de éxito o verificación: Usar tonos `emerald` (ej. `bg-emerald-500`, `text-emerald-500`).
- **Modo Oscuro**: Todos los nuevos componentes deben ser compatibles con el modo oscuro utilizando el prefijo `dark:`.
- **Clases dinámicas**: Utilizar los helpers `clsx` y `tailwind-merge` (`cn(...)`) para concatenar clases de Tailwind dinámicas de manera limpia y prevenir conflictos de especificidad.

---

## 3. Patrones de Diseño de Componentes

### A. Modales
Los cuadros de diálogo interactivos deben implementar de manera uniforme la siguiente estructura:
- Contenedor fijo en pantalla completa: `fixed inset-0 z-[100+]`.
- Fondo difuminado (backdrop blur): `backdrop-blur-sm bg-stone-900/30`.
- Animaciones de entrada suaves: `animate-in zoom-in-95 duration-200`.
- Distribución interior: Cabecera fija + cuerpo con scroll independiente (`overflow-y-auto`) + pie de página fijo con los botones de acción principal y secundaria.

### B. Controles de Formulario Estandarizados
Evitar la duplicación de inputs y usar la guía visual establecida:
- **Inputs de Texto**: Bordes redondeados y fondos suaves: `rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-slate-100 dark:border-stone-700/50 focus:ring-orange-500/20 focus:border-orange-500`.
- **Componentes Compartidos de Formulario (Trabajador)**: Importar siempre desde [serviceFormHelpers.tsx](file:///c:/Users/artur/Desktop/rental/BaseDatosPagosRH/BaseDatosPagosRH/src/components/workers/serviceFormHelpers.tsx). No reinventar ni duplicar estos componentes de forma local dentro de los modales:
  - `ApartamentoAutocomplete`: Input con autocompletado y filtrado inteligente de alojamientos.
  - `DuracionInput`: Unificador de horas y minutos que exporta una duración formateada como `HH:MM`.
  - `PagoSelector`: Menú para elegir el método de cobro/pago.
  - `SiNoToggle`: Interruptor estilizado en formato Sí/No.
  - `formatBizumNumber`: Formateo de teléfonos Bizum en bloques visuales `3-2-2-2`.
  - `SubmitFooter`: Pie de formulario del trabajador con soporte de tres estados de envío (inactivo, guardando borrador, enviando reporte definitivo).

---

## 4. Convenciones de Datos y Formatos

- **Coordenadas de Ubicación**: Se almacenan como cadenas de texto con el formato `"lat, lng"` con 5 o 6 decimales (ej. `"39.9864, -0.0513"`).
  - La herramienta canónica para capturar coordenadas con mapa interactivo es el `MapPickerModal` ubicado en [CleanCheckoutFormModal.tsx](file:///c:/Users/artur/Desktop/rental/BaseDatosPagosRH/BaseDatosPagosRH/src/components/cleans/CleanCheckoutFormModal.tsx).
- **Formatos de Teléfono**:
  - Visual: Agrupado de tres en tres y de dos en dos (`612 34 56 78`) con prefijo `+34` por defecto.
  - Envío a Sheets/DB: Limpiar caracteres no numéricos o espacios en blanco antes de guardar (`telefono.replace(/\D/g, '')` -> `34612345678`), excepto en campos específicos de firma o donde se requiera explícitamente el prefijo separado.
- **Tiempos y Duraciones**:
  - Las duraciones de trabajo y las horas de entrada o salida se almacenan como cadenas `text` con formato `"HH:MM"` (ej. `"02:45"` o `"14:30"`). Evitar los tipos nativos de PostgreSQL `time` o `interval` por su complejidad y facilidad para inducir bugs de zona horaria.
- **Gestión Horaria de Base de Datos**:
  - Las tablas `service_reports`, `key_deliveries` e `incident_reports` registran sus marcas temporales en la columna `created_at` utilizando el tipo `timestamp(0)` sin zona horaria, inicializadas por defecto a la hora de Madrid (`now() AT TIME ZONE 'Europe/Madrid'`). Esto garantiza que los administradores vean la hora de acción local de España en el editor SQL.

---

## 5. Control de Roles y Accesos

El sistema distingue cuatro niveles de acceso que condicionan las vistas y los permisos de la base de datos:
1. **admin**: Acceso completo a todas las métricas, control total de perfiles de usuario, borrado de registros, nóminas de trabajadores y configuración.
2. **editor**: Puede leer y escribir sobre alojamientos, incidencias y limpiezas, pero carece de permisos de borrado permanente o administración de usuarios.
3. **viewer**: Acceso exclusivo de lectura para supervisar la base de datos y paneles de analítica.
4. **trabajador**: Solo tiene visibilidad del panel móvil (`WorkerPanel.tsx`), donde puede crear sus reportes, rellenar incidencias/entregas vinculadas a su trabajo y consultar sus propios borradores o registros históricos.
