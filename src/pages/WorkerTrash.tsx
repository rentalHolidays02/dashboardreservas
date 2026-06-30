import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { appsScriptApi, activityLogApi } from '../services/api';
import { Worker, User } from '../services/mockData';

interface WorkerTrashProps {
  user: User;
}

const WorkerTrash: React.FC<WorkerTrashProps> = ({ user }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmHardDelete, setConfirmHardDelete] = useState<Worker | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await appsScriptApi.getDeletedWorkers();
      setWorkers(data);
    } catch (e) {
      console.error('Error loading trash:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (w: Worker) => {
    try {
      await appsScriptApi.restoreDeletedWorker(w.id);
      setWorkers(prev => prev.filter(x => x.id !== w.id));
      await activityLogApi.log(user.id || null, user.name || 'Usuario', `Restauró al trabajador "${w.fullName}"`, 'restaurar_trabajador');
    } catch (e) {
      console.error(e);
    }
  };

  const handleHardDelete = async (w: Worker) => {
    try {
      await appsScriptApi.hardDeleteWorker(w.id);
      setWorkers(prev => prev.filter(x => x.id !== w.id));
      setConfirmHardDelete(null);
      await activityLogApi.log(user.id || null, user.name || 'Usuario', `Eliminó definitivamente al trabajador "${w.fullName}"`, 'eliminar_trabajador');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="px-1">
        <h1 className="text-xl font-normal text-slate-800 dark:text-stone-200 tracking-tight font-display flex items-center gap-2">
          <Trash2 size={18} className="text-slate-400" />
          Papelera de trabajadores
        </h1>
        <p className="text-xs text-slate-400 dark:text-stone-500 mt-1">
          Los trabajadores eliminados se pueden restaurar o borrar definitivamente aquí.
        </p>
      </header>

      <div className="bg-white dark:bg-stone-950 border border-slate-200 dark:border-stone-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400 dark:text-stone-500">Cargando...</div>
        ) : workers.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-slate-300 dark:text-stone-600">
              <Trash2 size={22} />
            </div>
            <p className="text-sm text-slate-400 dark:text-stone-500">Papelera vacía</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {workers.map(w => (
              <li key={w.id} className="flex items-center justify-between px-5 py-4 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-normal text-slate-700 dark:text-stone-200 truncate">{w.fullName}</p>
                  <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">
                    {w.deletedAt ? `Eliminado el ${new Date(w.deletedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                    {w.telefono ? ` · ${w.telefono}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(w)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    <RotateCcw size={11} /> Restaurar
                  </button>
                  <button
                    onClick={() => setConfirmHardDelete(w)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmHardDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-stone-100">Eliminar definitivamente</p>
                <p className="text-[11px] text-slate-400 dark:text-stone-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-stone-300">
              Se borrarán todos los datos de <strong>{confirmHardDelete.fullName}</strong>: servicios, entregas de llaves, incidencias y borradores.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmHardDelete(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleHardDelete(confirmHardDelete)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerTrash;
