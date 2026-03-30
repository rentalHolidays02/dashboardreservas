import React from 'react';
import { Edit2 } from 'lucide-react';
import { Worker } from '../../services/mockData';

interface WorkersTableProps {
  workers: Worker[];
}

const WorkersTable: React.FC<WorkersTableProps> = ({ workers }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">Listado de Trabajadores</h3>
        <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
          {workers.length} trabajadores
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                Nombre Completo
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right whitespace-nowrap">
                Dinero Neto
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center whitespace-nowrap">
                Limpiezas
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right whitespace-nowrap">
                Kms
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center whitespace-nowrap">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {workers.map((worker) => (
              <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                  {worker.fullName}
                </td>
                <td className="px-6 py-4 text-sm text-slate-700 text-right font-mono">
                  {worker.netMoneyMonth.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </td>
                <td className="px-6 py-4 text-sm text-center">
                  <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                    {worker.cleansCountMonth}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 text-right">
                  {worker.kmsMonth} km
                </td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => console.log('Edit worker', worker.id)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Editar trabajador"
                  >
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkersTable;
