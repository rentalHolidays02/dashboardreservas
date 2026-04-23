import React, { useEffect, useState } from 'react';
import { Mail, User, Calendar, Loader2, Search, ArrowRight, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import { appsScriptApi } from '../services/api';
import { Suggestion } from '../services/mockData';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const fmtDate = (iso: string) => {
  if (!iso) return '--/--/----';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const Sugerencias: React.FC = () => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    const data = await appsScriptApi.getSuggestions();
    setSuggestions(data);
    setLoading(false);
  };

  const filteredSuggestions = suggestions.filter(s => {
    const term = searchTerm.toLowerCase();
    return s.subject.toLowerCase().includes(term) || 
           s.from.toLowerCase().includes(term) ||
           s.snippet.toLowerCase().includes(term);
  });

  if (loading) {
    return <LoadingSpinner message="Buscando sugerencias en el correo..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1 mb-2">
        <div>
          <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
            Sugerencias
          </h1>
          <p className="text-xs text-slate-400 dark:text-stone-500 mt-1">
            Correos electrónicos recibidos con sugerencias de mejora.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder="Buscar en sugerencias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* List View */}
        <div className={`${selectedSuggestion ? 'lg:col-span-5' : 'lg:col-span-12'} transition-all duration-300`}>
          <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-hidden shadow-sm">
            {filteredSuggestions.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center justify-center gap-2">
                <Mail size={32} className="text-slate-300 dark:text-stone-700" />
                <p className="text-sm text-slate-400 dark:text-stone-500">No se encontraron sugerencias</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredSuggestions.map((s) => (
                  <li 
                    key={s.id} 
                    className={`px-5 py-4 hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors cursor-pointer group relative ${selectedSuggestion?.id === s.id ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
                    onClick={() => setSelectedSuggestion(s)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {!s.isRead && <span className="w-2 h-2 bg-orange-500 rounded-full"></span>}
                        <span className="text-xs font-medium text-slate-600 dark:text-stone-300 truncate max-w-[150px]">
                          {s.from.split('<')[0].trim() || s.from}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-stone-500 tabular-nums">{fmtDate(s.date).split(',')[0]}</span>
                    </div>
                    <h3 className={`text-sm mb-1 truncate ${!s.isRead ? 'font-semibold text-slate-900 dark:text-stone-100' : 'font-normal text-slate-700 dark:text-stone-300'}`}>
                      {s.subject}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-stone-500 line-clamp-1">
                      {s.snippet}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detail View */}
        {selectedSuggestion && (
          <div className="lg:col-span-7 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
              <div className="p-6 border-b border-stone-100 dark:border-stone-800">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-lg font-medium text-slate-900 dark:text-stone-100 leading-tight">
                    {selectedSuggestion.subject}
                  </h2>
                  <button 
                    onClick={() => setSelectedSuggestion(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 transition-colors"
                  >
                    ×
                  </button>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <User size={14} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 dark:text-stone-300">{selectedSuggestion.from}</p>
                      <p className="text-slate-400 dark:text-stone-500 flex items-center gap-1">
                        <Clock size={10} /> {fmtDate(selectedSuggestion.date)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30 dark:bg-stone-900/10">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-slate-700 dark:text-stone-300 leading-relaxed text-sm">
                    {selectedSuggestion.body}
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-stone-50/50 dark:bg-stone-900/30 border-t border-stone-100 dark:border-stone-800 flex justify-end">
                <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-medium transition-all active:scale-95 shadow-sm shadow-orange-500/20">
                  <ArrowRight size={14} />
                  Responder sugerencia
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sugerencias;
