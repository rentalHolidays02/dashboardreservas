# 🏢 Sistema de Gestión BaseDatosPagosRH

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

**BaseDatosPagosRH** es una plataforma integral diseñada para la gestión eficiente de recursos humanos, pagos y logística operativa en el sector de alojamientos turísticos. El sistema centraliza la entrega de llaves, el reporte de incidencias, la gestión de limpiezas y el seguimiento financiero, integrándose perfectamente con Google Sheets para el almacenamiento de datos en tiempo real.

---

## 🚀 Características Principales

### 🔑 Entrega de Llaves y Recepción
*   **Registro Digital:** Captura de datos de huéspedes y validación de pagos.
*   **Firma Digital:** Integración de firmas manuscritas directamente en el formulario.
*   **Geolocalización:** Registro automático de la ubicación GPS al momento de la entrega.
*   **Sincronización:** Envío inmediato de datos a Google Sheets mediante Apps Script.

### 🛠️ Gestión de Incidencias
*   **Reporte Visual:** Sistema interactivo para documentar y categorizar problemas en los alojamientos.
*   **Seguimiento:** Historial de incidencias con capacidad de edición y actualización de estados.

### 🧹 Módulo de Limpiezas (Cleans)
*   **Planificación:** Gestión detallada de tareas de limpieza y estados de los apartamentos.
*   **Rutas Dinámicas:** Optimización de paradas y seguimiento de progreso.

### 📊 Análisis y Reportes
*   **Dashboard Interactivo:** Visualización de métricas clave mediante gráficos dinámicos (Recharts).
*   **Generación de PDFs:** Creación de informes profesionales (jsPDF) listos para descargar.

### 👥 Administración de Personal
*   **Gestión de Trabajadores:** Registro y control de perfiles de empleados.
*   **Pagos:** Seguimiento detallado de remuneraciones y transacciones financieras.

---

## 🛠️ Tecnologías Utilizadas

*   **Frontend:** React 18, TypeScript, Vite.
*   **Estilos:** Tailwind CSS para un diseño moderno y responsive.
*   **Mapas:** Leaflet para la visualización de ubicaciones geográficas.
*   **Gráficos:** Recharts para la analítica de datos.
*   **Backend / DB:** Google Apps Script integrado con Google Sheets.
*   **Documentación:** jsPDF y jsPDF-AutoTable.

---

## 💻 Instalación y Configuración

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/BaseDatosPagosRH.git
    ```
2.  **Instalar dependencias:**
    ```bash
    npm install
    ```
3.  **Configurar variables de entorno:**
    Crea un archivo `.env` basado en `.env.example` y añade tu URL de Google Apps Script:
    ```env
    VITE_APP_SCRIPT_URL=tu_url_aqui
    VITE_SUPABASE_URL=tu_url_supabase
    VITE_SUPABASE_ANON_KEY=tu_anon_key
    ```

### 🗄️ Configuración de Supabase
Para la gestión de roles, se recomienda crear una tabla `profiles` en el esquema `public`:
```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique,
  full_name text,
  role text check (role in ('admin', 'editor', 'viewer')) default 'viewer'
);
```
4.  **Ejecutar en modo desarrollo:**
    ```bash
    npm run dev
    ```

---

## 📞 Contacto

Si tienes alguna duda o necesitas soporte técnico, puedes contactar con el equipo de desarrollo:

| Nombre | Correo Electrónico | Teléfono |
| :--- | :--- | :--- |
| **Benjamin** | [benje1612@gmail.com](mailto:benje1612@gmail.com) | 661133889 |
| **Adrian** | [adrian2000gg@gmail.com](mailto:adrian2000gg@gmail.com) | 641211926 |
| **David** | [dberlinches2003@gmail.com](mailto:dberlinches2003@gmail.com) | 697609756 |

---

## ⚖️ Copyright y Licencia

© **2026 Rental Holidays SL**. Todos los derechos reservados.

Este software ha sido desarrollado por **David Berlinches Amores**, **Benjamin Vargas** y **Adrian Garcia** para **Rental Holidays SL**. 

Este sistema es propiedad privada y confidencial. Queda estrictamente prohibida la reproducción, distribución o modificación no autorizada de este código fuente sin el consentimiento expreso de los autores y la entidad titular. El uso de este sistema está sujeto a los términos de servicio internos de la organización.

---