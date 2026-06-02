import React from 'react';
import { X, FileText } from 'lucide-react';

// Versión del texto. Si cambian los T&C de forma sustancial, actualizar para forzar reaceptación.
export const TERMS_VERSION = '2026-06-02';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const h = 'text-sm font-semibold text-slate-800 dark:text-stone-200 mt-5 mb-1.5';
  const p = 'text-xs leading-relaxed text-slate-600 dark:text-stone-400';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-100 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
              <FileText size={16} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-stone-100">
                Términos y Condiciones de uso
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-stone-500">
                Versión {TERMS_VERSION} · Rental Holidays
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-slate-400 hover:text-slate-700 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="overflow-y-auto px-6 py-5">
          <p className={p}>
            Al acceder y utilizar esta plataforma, el usuario reconoce haber leído y aceptado
            las siguientes condiciones, que regulan el uso interno de la aplicación de gestión
            de Rental Holidays.
          </p>

          <h3 className={h}>1. Finalidad de la plataforma</h3>
          <p className={p}>
            Esta web es una herramienta interna destinada exclusivamente a la gestión de
            recursos humanos, limpiezas, entregas de llaves, incidencias y pagos relacionados
            con los alojamientos turísticos administrados por Rental Holidays. Su uso queda
            restringido al personal autorizado.
          </p>

          <h3 className={h}>2. Datos personales tratados</h3>
          <p className={p}>
            El usuario consiente que la plataforma trate sus datos identificativos (nombre,
            apellidos, correo electrónico, teléfono, rol asignado) y los datos derivados de
            su actividad laboral (registros de limpiezas realizadas, entregas, incidencias
            reportadas y pagos asociados). El responsable del tratamiento es Rental Holidays.
          </p>

          <h3 className={h}>3. Geolocalización</h3>
          <p className={p}>
            Durante el registro de limpiezas y entregas de llaves la aplicación puede solicitar
            acceso a la ubicación del dispositivo del usuario para asociar coordenadas GPS al
            servicio. El usuario otorga su consentimiento expreso para esta captura, que se
            realizará únicamente en el momento del registro y con la finalidad de verificar la
            ejecución del servicio.
          </p>

          <h3 className={h}>4. Firmas digitales</h3>
          <p className={p}>
            En el flujo de entrega de llaves la plataforma captura la firma manuscrita del
            trabajador y del huésped sobre el dispositivo. Dichas firmas se almacenan como
            imágenes vinculadas al registro y tienen el valor de conformidad con la entrega
            efectuada.
          </p>

          <h3 className={h}>5. Fotografías e imágenes adjuntas</h3>
          <p className={p}>
            Al adjuntar fotografías a incidencias, limpiezas o alojamientos, el usuario
            garantiza disponer del permiso necesario de las personas u objetos retratados,
            asumiendo la responsabilidad por cualquier contenido que infrinja derechos de
            terceros.
          </p>

          <h3 className={h}>6. Confidencialidad y uso de credenciales</h3>
          <p className={p}>
            El usuario se compromete a custodiar sus credenciales de acceso y a no compartirlas
            con terceros. Toda la información a la que acceda mediante esta plataforma es
            confidencial y no podrá ser divulgada, copiada ni utilizada fuera del ámbito de su
            actividad laboral para Rental Holidays.
          </p>

          <h3 className={h}>7. Conservación de datos y derechos del usuario</h3>
          <p className={p}>
            Los datos se conservarán mientras dure la relación laboral con Rental Holidays y
            durante los plazos legalmente exigibles tras su finalización (hasta 6 años para
            obligaciones fiscales y laborales). El usuario podrá ejercer sus derechos de
            acceso, rectificación, supresión, oposición, limitación y portabilidad dirigiendo
            su solicitud al responsable del tratamiento.
          </p>

          <h3 className={h}>8. Aceptación</h3>
          <p className={p}>
            La creación de la cuenta y el inicio de sesión en la plataforma implican la
            aceptación expresa de los presentes Términos y Condiciones. En caso de no estar
            conforme, el usuario debe abstenerse de utilizar la aplicación y comunicarlo al
            departamento de RR.HH.
          </p>
        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-stone-100 dark:border-stone-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
