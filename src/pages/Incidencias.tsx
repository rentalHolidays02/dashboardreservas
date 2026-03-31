import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Banknote, Building2, UserRound, Home, Loader2 } from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { Incidencia } from '../services/mockData';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

const fmtCost = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const Incidencias: React.FC = () => {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appsScriptApi.getRecentIncidencias(50).then(data => {
      setIncidencias(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 font-medium">Cargando incidencias...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-10 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <AlertTriangle size={24} className="text-slate-800" />
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 font-display">Incidencias</h1>
          {incidencias.length > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm bg-red-100 text-red-500 font-medium">
              {incidencias.length}
            </span>
          )}
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {incidencias.length === 0 ? (
          <div className="px-5 py-12 flex flex-col items-center justify-center gap-2">
            <AlertTriangle size={32} className="text-slate-300" />
            <p className="text-sm text-slate-400">No hay incidencias registradas</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {incidencias.map((inc) => (
              <li key={inc.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">{inc.userName}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{fmtDate(inc.timestamp)}</span>
                </div>

                <p className="text-sm font-normal text-slate-800 leading-snug mb-3">
                  {inc.description.charAt(0).toUpperCase() + inc.description.slice(1)}
                </p>

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
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-700">
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
        )}
      </div>
    </div>
  );
};

export default Incidencias;
