import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Euro, Calendar, Ruler } from 'lucide-react';

interface ChartPoint {
  label: string;
  dinero: number;
  limpiezas: number;
  km: number;
}

interface PerformanceChartProps {
  data: ChartPoint[];
}

type Metric = 'dinero' | 'limpiezas' | 'km';

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  const [metric, setMetric] = useState<Metric>('dinero');

  const configs = {
    dinero:    { label: 'Dinero', icon: Euro,     color: '#f97316', gradient: 'orange' },
    limpiezas: { label: 'Limpiezas', icon: Calendar, color: '#f97316', gradient: 'orange' },
    km:        { label: 'Kilómetros', icon: Ruler,    color: '#fb923c', gradient: 'orange' },
  };

  const active = configs[metric];

  const CustomTooltip: React.FC<any> = ({ active: tooltipActive, payload, label }) => {
    if (!tooltipActive || !payload?.length) return null;
    return (
      <div className="bg-white/90 dark:bg-stone-900/95 backdrop-blur-xl border border-white/60 dark:border-stone-800/50 rounded-xl px-4 py-3 text-xs soft-shadow animate-in fade-in zoom-in-95 duration-200">
        <p className="text-slate-400 dark:text-stone-500 mb-1 font-medium">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: active.color }} />
          <p className="font-semibold text-slate-800 dark:text-stone-200">
            {payload[0].value.toLocaleString('es-ES')} {metric === 'dinero' ? '€' : metric === 'km' ? 'km' : ''}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-800/50 rounded-3xl p-6 lg:p-8 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display mb-1">Rendimiento Temporal</h3>
          <p className="text-xs text-slate-400 dark:text-stone-500">Visualiza la evolución de {active.label.toLowerCase()} en el periodo seleccionado</p>
        </div>

        <div className="flex bg-stone-100/50 dark:bg-stone-800/50 p-1.5 rounded-2xl border border-white/40 dark:border-stone-700/50 w-fit">
          {(Object.keys(configs) as Metric[]).map((m) => {
            const Icon = configs[m].icon;
            const isSel = metric === m;
            return (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
                  isSel
                    ? 'bg-white dark:bg-stone-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300'
                }`}
              >
                <Icon size={14} className={isSel ? 'text-orange-500' : ''} />
                <span>{configs[m].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={active.color} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={active.color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 400 }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 400 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                metric === 'dinero' && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
              }
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={active.color}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#gradient-${metric})`}
              animationDuration={1500}
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: active.color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceChart;
