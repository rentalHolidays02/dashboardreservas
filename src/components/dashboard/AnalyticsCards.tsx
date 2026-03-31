import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, HelpCircle, Banknote, Building2, UserRound, Home } from 'lucide-react';
import { CheckInOut, Incidencia } from '../../services/mockData';

interface AnalyticsCardsProps {
  checkIns: CheckInOut[];
  incidencias: Incidencia[];
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

const fmtCost = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const WorkingBadge: React.FC = () => {
  const [step, setStep] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setStep(s => s === 3 ? 1 : s + 1), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center text-xs">
      <span className="working-badge">
        Trabajando
        <span style={{ opacity: step >= 1 ? 1 : 0 }}>.</span>
        <span style={{ opacity: step >= 2 ? 1 : 0 }}>.</span>
        <span style={{ opacity: step >= 3 ? 1 : 0 }}>.</span>
      </span>
    </span>
  );
};

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative group">
    <HelpCircle size={14} className="text-slate-300 hover:text-slate-400 cursor-default transition-colors" />
    <div className="absolute bottom-full right-0 mb-2.5 w-64 bg-white border border-slate-200 text-slate-600 text-xs rounded-xl px-3.5 py-3 leading-relaxed invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20 shadow-sm">
      {text}
      <div className="absolute top-full right-3.5 border-4 border-transparent border-t-slate-200" />
      <div className="absolute top-full right-[15px] border-[3px] border-transparent border-t-white" />
    </div>
  </div>
);

const COL_CHECKINS = 'grid-cols-[1fr_1fr_80px_110px]';

const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ checkIns, incidencias }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[11fr_9fr] gap-6 items-stretch">

      {/* Módulo 1: Actividad de limpiadores */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-base font-medium font-display tracking-tight text-slate-800">Actividad de limpiadores</p>
          <InfoTooltip text="Muestra los últimos registros de entrada y salida de los limpiadores en los alojamientos." />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col flex-1">
          <div className={`grid ${COL_CHECKINS} px-5 py-3 border-b border-slate-100`}>
            <span className="text-xs text-slate-400">Limpiador</span>
            <span className="text-xs text-slate-400">Alojamiento</span>
            <span className="text-xs text-slate-400">Hora</span>
            <span className="text-xs text-slate-400">Estado</span>
          </div>

          <ul className="overflow-y-auto divide-y divide-slate-50" style={{ height: '192px' }}>
            {checkIns.length === 0 ? (
              <li className="px-5 py-6 flex items-center justify-center">
                <span className="text-xs text-slate-400">Sin actividad registrada</span>
              </li>
            ) : (
              checkIns.map((entry) => (
                <li key={entry.id} className={`module-item grid ${COL_CHECKINS} items-center`}>
                  <p className="text-sm text-slate-800 truncate">{entry.cleanerName}</p>
                  <p className="text-xs text-slate-500 truncate">{entry.accommodation}</p>
                  <span className="text-xs text-slate-500 tabular-nums">{fmtTime(entry.timestamp)}</span>
                  <div>
                    {entry.type === 'check-in' ? <WorkingBadge /> : (
                      <span className="text-xs text-slate-400">Finalizado</span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>

          <div className="flex-1 flex items-center justify-center gap-1.5">
            <HelpCircle size={10} className="text-slate-300 flex-shrink-0" />
            <span className="text-[11px] text-slate-300">No hay más usuarios</span>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 flex justify-center">
            <span className="text-xs text-slate-400 cursor-not-allowed select-none">Mostrar más</span>
          </div>
        </div>
      </div>

      {/* Módulo 2: Incidencias recientes */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-slate-800 flex-shrink-0" />
            <p className="text-base font-medium font-display tracking-tight text-slate-800">Incidencias recientes</p>
            {incidencias.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs bg-red-100 text-red-500">
                {incidencias.length}
              </span>
            )}
          </div>
          <InfoTooltip text="Reportes enviados por los limpiadores. Incluye el coste de resolución y quién lo asumió." />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col flex-1">
          <ul className="flex-1 divide-y divide-slate-100">
            {incidencias.slice(0, 3).map((inc) => (
              <li key={inc.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                {/* Top: usuario + hora */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">{inc.userName}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{fmtDate(inc.timestamp)}</span>
                </div>

                {/* Descripción */}
                <p className="text-sm font-medium text-slate-800 leading-snug mb-3">
                  {inc.description.charAt(0).toUpperCase() + inc.description.slice(1)}
                </p>

                {/* Footer: alojamiento + coste + pagador */}
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/alojamientos/${inc.accommodationId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 rounded-md px-2 py-1 hover:text-blue-600 hover:border-blue-200 transition-colors shrink-0"
                  >
                    <Home size={10} className="text-slate-400" />
                    {inc.accommodationName}
                    <ExternalLink size={9} className="text-slate-300" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                      <Banknote size={12} className="text-slate-400" />
                      {fmtCost(inc.coste)}
                    </span>
                    {inc.pagadoPor === 'limpiador' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-md px-2 py-0.5">
                        <UserRound size={10} />
                        Limpiador
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-2 py-0.5">
                        <Building2 size={10} />
                        Empresa
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="px-5 py-3 border-t border-slate-100 flex justify-center">
            <span className="text-xs text-slate-400 cursor-not-allowed select-none">Mostrar más</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AnalyticsCards;
