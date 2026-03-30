import React from 'react';
import { CheckInOut } from '../../services/mockData';
import { LogIn, LogOut } from 'lucide-react';

interface Props {
  entries: CheckInOut[];
}

const CheckInsModule: React.FC<Props> = ({ entries }) => {
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Últimos Check-ins / Check-outs</h2>
          <p className="text-sm text-slate-500">Actividad reciente de limpiadores en alojamientos</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-5 py-3">Limpiador</th>
              <th className="px-5 py-3 hidden sm:table-cell">Alojamiento</th>
              <th className="px-5 py-3">Hora</th>
              <th className="px-5 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-800">{entry.cleanerName}</td>
                <td className="px-5 py-3 text-slate-500 hidden sm:table-cell">{entry.accommodation}</td>
                <td className="px-5 py-3 text-slate-500 tabular-nums">{formatTime(entry.timestamp)}</td>
                <td className="px-5 py-3">
                  {entry.type === 'check-in' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <LogIn size={11} />
                      Check In
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <LogOut size={11} />
                      Check Out
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default CheckInsModule;
