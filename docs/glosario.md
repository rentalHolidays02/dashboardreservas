# Glosario de Términos

Este glosario define los términos del negocio y técnicos más relevantes del sistema **BaseDatosPagosRH** para garantizar que los miembros del equipo utilicen un lenguaje común y uniforme.

---

## Términos del Dominio del Negocio (Rental Holidays)

- **Alojamiento (Accommodation / Apartamento)**: Propiedad inmobiliaria destinada al alquiler turístico gestionada por la empresa. Cada alojamiento cuenta con un nombre identificativo único, dirección física, ciudad y un estado de actividad (activo/inactivo).
- **Trabajador (Worker)**: Empleado registrado en el sistema. Los trabajadores pertenecen a dos categorías principales:
  - **Limpiador**: Encargado de la puesta a punto del alojamiento y reposición de ropa de cama/toallas.
  - **Manitas (Handyman)**: Técnico encargado del mantenimiento físico y resolución de incidencias en los pisos.
- **Parte de Servicio (Service Report)**: Formulario digital cumplimentado por el trabajador al terminar sus tareas en un alojamiento. Se clasifica en dos tipos según la actividad:
  - **Reserva**: Limpieza estándar ligada a la entrada/salida de un huésped.
  - **Manitas**: Labores de reparación en la propiedad.
- **Entrega de Llaves (Key Delivery / Check-in)**: Proceso de recepción del huésped. Involucra la entrega física de las llaves del apartamento, validación de cobros de renta o fianza, cálculo de kilometraje del operario y recopilación de firmas digitales.
- **Fianza (Garantía / Depósito)**: Monto económico exigido al huésped como garantía para cubrir desperfectos. Se puede gestionar a través de tres métodos de pago/cobro: Efectivo, Tarjeta o Bizum.
- **Incidencia (Incident)**: Rotura, fallo de funcionamiento o desperfecto físico detectado en un alojamiento. Puede ser reportada directamente por el administrador desde el panel o a través de un parte de incidencia del trabajador en el móvil.
- **Bizum**: Sistema de pago móvil inmediato español. En la aplicación se requiere introducir el número telefónico del remitente y el importe de la transacción para el cobro de la fianza.

---

## Términos Técnicos del Sistema

- **Perfil de Usuario (Profile)**: Fila de la tabla `profiles` vinculada a un registro de autenticación. Define los datos de contacto y el nivel de privilegios del usuario en la aplicación (Roles: `admin`, `editor`, `viewer`, `trabajador`).
- **Google Apps Script Proxy**: Servicio web intermedio programado en JavaScript que corre en los servidores de Google. Recibe peticiones HTTP desde el frontend y manipula la hoja de cálculo de Sheets de forma segura sin exponer credenciales corporativas en el cliente.
- **Borrador (Draft)**:
  - **Borrador en la Nube (Cloud Draft)**: Registro parcial de un parte de trabajo guardado en la tabla `report_drafts` de Supabase. Permite recuperar la información desde múltiples dispositivos.
  - **Borrador Local (Local Draft)**: Respaldo de seguridad en el `localStorage` del navegador del dispositivo móvil. Se genera al cerrar accidentalmente un formulario sin presionar "Guardar en borrador" ni "Enviar".
- **Reverse Geocoding (Nominatim)**: Servicio web público basado en OpenStreetMap que recibe coordenadas latitud y longitud y devuelve la dirección urbana exacta (calle, portal y código postal).
- **Leaflet**: Biblioteca open-source en JavaScript para maquetar mapas interactivos ligeros y adaptables a pantallas móviles.
- **Bucket de Firmas (Storage - signatures)**: Espacio de almacenamiento de objetos binarios en Supabase donde se guardan las firmas digitales recogidas en las entregas de llaves en formato de imágenes PNG o JPEG públicas.
- **RPC (Remote Procedure Call)**: Función almacenada directamente en la base de datos PostgreSQL que puede ser invocada de manera segura desde el cliente React (ej. `admin_delete_user`).
- **Security Definer**: Atributo de funciones en PostgreSQL que fuerza a la función a ejecutarse con los privilegios del usuario creador (normalmente el superusuario `postgres`), permitiendo saltarse temporalmente restricciones de RLS para tareas críticas.
- **RLS (Row Level Security)**: Seguridad a nivel de fila de PostgreSQL que define qué usuarios autenticados pueden consultar, insertar, modificar o borrar registros de cada tabla en base a su rol o identidad.
- **madrid_time / Hora Civil de Madrid**: Marca de tiempo ajustada al huso horario de España (`Europe/Madrid`), prescindiendo del formato offset UTC en la persistencia del histórico para facilitar lecturas visuales administrativas en Excel y Supabase.
