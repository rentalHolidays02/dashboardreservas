import React from 'react';
import { Trophy, Star, TrendingUp, Building2, User as UserIcon } from 'lucide-react';

interface RankingItem {
  id: string;
  name: string;
  value: number;
  secondaryValue: string;
  photo?: string;
}

interface RankingsGridProps {
  workerRankings: RankingItem[];
  accommodationRankings: RankingItem[];
}

const RankingCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: RankingItem[];
  type: 'worker' | 'accommodation';
}> = ({ title, icon, items, type }) => {
  const maxValue = Math.max(...items.map(i => i.value), 1);

  return (
    <div className="bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-800/50 rounded-3xl p-6 flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500/10 text-orange-500 p-2.5 rounded-xl">
            {icon}
          </div>
          <h3 className="text-lg font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">{title}</h3>
        </div>
        <Trophy size={18} className="text-orange-400" />
      </div>

      <div className="space-y-4">
        {items.map((item, idx) => {
          const percentage = (item.value / maxValue) * 100;
          const isTop3 = idx < 3;

          return (
            <div key={item.id} className="relative group animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
              <div className="flex items-center gap-4 mb-2">
                {/* Ranking Number */}
                <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold ${
                  idx === 0 ? 'bg-orange-600 text-white shadow-sm' :
                  idx === 1 ? 'bg-orange-500/80 text-white shadow-sm' :
                  idx === 2 ? 'bg-orange-400/70 text-white shadow-sm' :
                  'bg-orange-500/10 text-orange-400'
                }`}>
                  {idx + 1}
                </div>

                {/* Avatar/Icon */}
                {type === 'worker' ? (
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-stone-800 overflow-hidden flex-shrink-0 border-2 border-white/80 dark:border-stone-700/50 soft-shadow group-hover:scale-105 transition-transform duration-300">
                    {item.photo ? (
                      <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                        {item.name.charAt(0)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-orange-50/50 dark:bg-orange-900/10 flex items-center justify-center text-orange-500 flex-shrink-0 border border-orange-100/50 dark:border-orange-800/20 group-hover:scale-105 transition-transform duration-300">
                    <Building2 size={18} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-stone-200 truncate">{item.name}</p>
                    <p className="text-xs font-semibold text-slate-600 dark:text-stone-400 tabular-nums whitespace-nowrap">{item.secondaryValue}</p>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-1.5 bg-orange-500/5 dark:bg-orange-500/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        idx === 0 ? 'bg-orange-600' :
                        idx === 1 ? 'bg-orange-500/80' :
                        idx === 2 ? 'bg-orange-400/70' :
                        'bg-orange-400/40'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RankingsGrid: React.FC<RankingsGridProps> = ({ workerRankings, accommodationRankings }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
      <RankingCard 
        title="Ranking de Trabajadores" 
        icon={<UserIcon size={18} />} 
        items={workerRankings} 
        type="worker"
      />
      <RankingCard 
        title="Ranking de Alojamientos" 
        icon={<Building2 size={18} />} 
        items={accommodationRankings} 
        type="accommodation"
      />
    </div>
  );
};

export default RankingsGrid;
