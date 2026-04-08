import React from 'react';

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
  items: RankingItem[];
  type: 'worker' | 'accommodation';
}> = ({ title, items, type }) => {
  return (
    <div className="bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-800/50 rounded-3xl p-6 flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">{title}</h3>
      </div>

      <div className="space-y-4">
        {items.map((item, idx) => {
          return (
            <div key={item.id} className="relative group animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
              <div className="flex items-center gap-4 mb-2">
                {/* Ranking Number */}
                <span className="flex-shrink-0 w-4 text-[11px] font-normal text-slate-300 dark:text-stone-600 tabular-nums">
                  {idx + 1}
                </span>

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
                  <div className="w-10 h-10 rounded-xl bg-orange-50/50 dark:bg-orange-900/10 flex items-center justify-center text-orange-400 flex-shrink-0 border border-orange-100/50 dark:border-orange-800/20 group-hover:scale-105 transition-transform duration-300">
                    <span className="text-xs font-medium">{item.name.charAt(0)}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-stone-200 truncate">{item.name}</p>
                    <p className="text-xs font-normal text-slate-400 dark:text-stone-500 tabular-nums whitespace-nowrap">{item.secondaryValue}</p>
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
        items={workerRankings}
        type="worker"
      />
      <RankingCard
        title="Ranking de Alojamientos"
        items={accommodationRankings}
        type="accommodation"
      />
    </div>
  );
};

export default RankingsGrid;
