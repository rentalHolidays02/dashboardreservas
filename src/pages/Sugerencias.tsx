import React, { useEffect, useState } from 'react';
import { Mail, User, Calendar, Loader2, Search, ArrowRight, MessageSquare, Clock, CheckCircle2, X, Trash2, Eye, EyeOff, Filter, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
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

type FilterTab = 'todos' | 'leidos' | 'no-leidos';
type CategoryTab = 'todos' | 'fallo' | 'sugerencia' | 'otro';

const Sugerencias: React.FC = () => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('todos');
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('todos');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    const data = await appsScriptApi.getSuggestions();
    setSuggestions(data);
    setLoading(false);
  };

  const handleSelect = async (s: Suggestion) => {
    setActiveSuggestion(s);
    setSelectedSuggestion(s);
    setIsDetailVisible(true);
    
    // Auto-marcar como leído al abrir si no lo está
    if (!s.isRead) {
      handleToggleRead(s.id, true);
    }
  };

  const handleClose = () => {
    setIsDetailVisible(false);
    setTimeout(() => {
      setSelectedSuggestion(null);
    }, 600);
  };

  const handleToggleRead = async (id: string, read: boolean) => {
    setActionLoading(id);
    const ok = read 
      ? await appsScriptApi.markSuggestionAsRead(id)
      : await appsScriptApi.markSuggestionAsUnread(id);
    
    if (ok) {
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, isRead: read } : s));
      if (activeSuggestion?.id === id) {
        setActiveSuggestion(prev => prev ? { ...prev, isRead: read } : null);
      }
    }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres borrar esta sugerencia? Se moverá a la papelera de Gmail.')) return;
    
    setActionLoading(id);
    const ok = await appsScriptApi.deleteSuggestion(id);
    if (ok) {
      setSuggestions(prev => prev.filter(s => s.id !== id));
      if (activeSuggestion?.id === id) {
        handleClose();
      }
    }
    setActionLoading(null);
  };

  const filteredSuggestions = suggestions.filter(s => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = s.subject.toLowerCase().includes(term) || 
                         s.from.toLowerCase().includes(term) ||
                         s.snippet.toLowerCase().includes(term);
    
    const matchesTab = activeTab === 'todos' || 
                      (activeTab === 'leidos' && s.isRead) || 
                      (activeTab === 'no-leidos' && !s.isRead);
    
    const matchesCategory = activeCategory === 'todos' || s.category === activeCategory;
    
    return matchesSearch && matchesTab && matchesCategory;
  });

  const getCategoryStyles = (cat?: string) => {
    switch (cat) {
      case 'fallo': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50';
      case 'sugerencia': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
      case 'otro': return 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border-slate-200 dark:border-slate-700/50';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border-slate-200 dark:border-slate-700/50';
    }
  };

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'fallo': return <AlertCircle size={10} />;
      case 'sugerencia': return <Sparkles size={10} />;
      default: return <HelpCircle size={10} />;
    }
  };

  if (loading) {
    return <LoadingSpinner message="Sincronizando con Gmail..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col gap-4 px-1 mb-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display">
              Sugerencias y Feedback
            </h1>
            <p className="text-xs text-slate-400 dark:text-stone-500 mt-1">
              Gestiona los comentarios recibidos desde la aplicación.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-white/60 dark:border-stone-700/50 rounded-xl text-slate-700 dark:text-stone-300 text-xs font-normal placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none transition-all hover:bg-white/80 dark:hover:bg-stone-800/60 focus:bg-white dark:focus:bg-stone-900"
            />
          </div>
        </div>

        {/* Filtros y Tabs */}
        <div className="flex flex-wrap items-center gap-6 border-b border-slate-200 dark:border-stone-800 pb-1">
          <div className="flex items-center gap-1">
            {(['todos', 'no-leidos', 'leidos'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-all relative ${
                  activeTab === tab 
                  ? 'text-orange-500' 
                  : 'text-slate-500 dark:text-stone-500 hover:text-slate-700 dark:hover:text-stone-300'
                }`}
              >
                {tab === 'todos' ? 'Todos' : tab === 'leidos' ? 'Leídos' : 'No leídos'}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-full animate-in fade-in zoom-in duration-300"></span>
                )}
                {tab === 'no-leidos' && suggestions.filter(s => !s.isRead).length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-orange-500 text-[10px] text-white rounded-full">
                    {suggestions.filter(s => !s.isRead).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-stone-800 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <Filter size={12} className="text-slate-400" />
            {(['todos', 'fallo', 'sugerencia', 'otro'] as CategoryTab[]).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-[10px] font-medium border transition-all ${
                  activeCategory === cat
                  ? 'bg-slate-800 text-white border-slate-800 dark:bg-stone-200 dark:text-stone-900 dark:border-stone-200'
                  : 'bg-transparent text-slate-500 border-slate-200 dark:border-stone-800 hover:border-slate-300 dark:hover:border-stone-700'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={`suggestions-grid items-start ${isDetailVisible ? 'detail-open' : 'detail-closed'}`}>
        {/* List View */}
        <div className="min-w-0 h-fit">
          <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-hidden shadow-sm">
            {filteredSuggestions.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center justify-center gap-2">
                <Mail size={32} className="text-slate-300 dark:text-stone-700" />
                <p className="text-sm text-slate-400 dark:text-stone-500">No hay correos que coincidan con los filtros</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredSuggestions.map((s) => (
                  <li 
                    key={s.id} 
                    className={`px-5 py-4 hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors cursor-pointer group relative ${selectedSuggestion?.id === s.id ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
                    onClick={() => handleSelect(s)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {!s.isRead && <span className="w-2 h-2 bg-orange-500 rounded-full"></span>}
                        <span className="text-xs font-medium text-slate-600 dark:text-stone-300 truncate max-w-[150px]">
                          {s.from.split('<')[0].trim() || s.from}
                        </span>
                        {s.category && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getCategoryStyles(s.category)}`}>
                            {s.category}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-stone-500 tabular-nums">{fmtDate(s.date).split(',')[0]}</span>
                    </div>
                    <h3 className={`text-sm mb-1 truncate ${!s.isRead ? 'font-semibold text-slate-900 dark:text-stone-100' : 'font-normal text-slate-700 dark:text-stone-300'}`}>
                      {s.subject}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-stone-500 line-clamp-1">
                      {s.snippet}
                    </p>

                    {/* Acciones rápidas al hover */}
                    <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleToggleRead(s.id, !s.isRead); }}
                        className="p-1.5 bg-white dark:bg-stone-800 border border-slate-200 dark:border-stone-700 rounded-lg text-slate-500 hover:text-orange-500 shadow-sm"
                        title={s.isRead ? "Marcar como no leído" : "Marcar como leído"}
                      >
                        {s.isRead ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                        className="p-1.5 bg-white dark:bg-stone-800 border border-slate-200 dark:border-stone-700 rounded-lg text-slate-500 hover:text-red-500 shadow-sm"
                        title="Borrar sugerencia"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className={`detail-view-container h-fit ${isDetailVisible ? 'visible-state' : 'hidden-state'}`}>
          {activeSuggestion && (
            <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-6 border-b border-stone-100 dark:border-stone-800">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-2">
                    {activeSuggestion.category && (
                      <span className={`w-fit flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getCategoryStyles(activeSuggestion.category)}`}>
                        {getCategoryIcon(activeSuggestion.category)}
                        {activeSuggestion.category}
                      </span>
                    )}
                    <h2 className="text-lg font-medium text-slate-900 dark:text-stone-100 leading-tight">
                      {activeSuggestion.subject}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleRead(activeSuggestion.id, !activeSuggestion.isRead)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 transition-colors p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
                      title={activeSuggestion.isRead ? "Marcar como no leído" : "Marcar como leído"}
                    >
                      {activeSuggestion.isRead ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button 
                      onClick={() => handleDelete(activeSuggestion.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                      title="Mover a la papelera"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button 
                      onClick={handleClose}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 transition-colors p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <User size={14} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 dark:text-stone-300">{activeSuggestion.from}</p>
                      <p className="text-slate-400 dark:text-stone-500 flex items-center gap-1">
                        <Clock size={10} /> {fmtDate(activeSuggestion.date)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30 dark:bg-stone-900/10 max-h-[400px]">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-slate-700 dark:text-stone-300 leading-relaxed text-sm">
                    {activeSuggestion.body}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Sugerencias;
