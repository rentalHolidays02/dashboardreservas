import React from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, AlertTriangle, ExternalLink } from 'lucide-react';
import { CheckInOut, Incidencia } from '../../services/mockData';

interface AnalyticsCardsProps {
  checkIns: CheckInOut[];
  incidencias: Incidencia[];
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ checkIns, incidencias }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">

      {/* Módulo 1: Últimos check-ins / check-outs */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="module-header">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Últimos check-ins / check-outs
          </p>
        </div>
        <ul className="divide-y divide-slate-50 flex-1">
          {checkIns.slice(0, 3).map((entry) => (
            <li key={entry.id} className="module-item flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{entry.cleanerName}</p>
                <p className="text-xs text-slate-400 truncate">{entry.accommodation}</p>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <span className="text-xs text-slate-400 tabular-nums">{fmt(entry.timestamp)}</span>
                {entry.type === 'check-in' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <LogIn size={10} /> Check In
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <LogOut size={10} /> Check Out
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="px-5 py-2.5 border-t border-slate-100 flex justify-center">
          <span className="text-xs text-slate-400 cursor-not-allowed select-none">
            Mostrar más
          </span>
        </div>
      </div>

      {/* Módulo 2: Incidencias recientes */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="module-header">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Incidencias recientes
          </p>
          {incidencias.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold bg-red-100 text-red-600">
              {incidencias.length}
            </span>
          )}
        </div>
        <ul className="divide-y divide-slate-50 flex-1">
          {incidencias.slice(0, 3).map((inc) => (
            <li key={inc.id} className="module-item flex items-center gap-3">
              <div className="mt-0.5 p-1.5 rounded-lg bg-red-50 text-red-500 shrink-0">
                <AlertTriangle size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 leading-snug">
                  <span className="font-semibold">{inc.userName}</span>
                  {' '}ha reportado{' '}
                  <span className="text-slate-600">{inc.description}</span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 tabular-nums">{fmt(inc.timestamp)}</span>
                  <span className="text-slate-300">·</span>
                  <Link
                    to={`/alojamientos/${inc.accommodationId}`}
                    className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {inc.accommodationName}
                    <ExternalLink size={10} />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="px-5 py-2.5 border-t border-slate-100 flex justify-center">
          <span className="text-xs text-slate-400 cursor-not-allowed select-none">
            Mostrar más
          </span>
        </div>
      </div>

    </div>
  );
};

export default AnalyticsCards;
