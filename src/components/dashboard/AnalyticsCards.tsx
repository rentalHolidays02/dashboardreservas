import React from 'react';
import { Euro, CheckCircle2 } from 'lucide-react';

interface AnalyticsCardsProps {
  totalMoney: number;
  totalCleans: number;
}

const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ totalMoney, totalCleans }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Gasto Total */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
          <Euro size={28} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Gasto total del mes
          </p>
          <p className="text-2xl font-bold text-slate-900">
            {totalMoney.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>

      {/* Limpiezas Realizadas */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
        <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
          <CheckCircle2 size={28} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Limpiezas realizadas
          </p>
          <p className="text-2xl font-bold text-slate-900">
            {totalCleans}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCards;
