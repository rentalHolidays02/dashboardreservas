import React from 'react';

interface LoadingSpinnerProps {
  message?: string; // Mantenido por retrocompatibilidad con las llamadas actuales, pero no se renderiza.
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  fullScreen = false 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center w-full animate-in fade-in duration-700 ${fullScreen ? 'fixed inset-0 z-50 bg-white/50 dark:bg-stone-950/50 backdrop-blur-sm' : 'h-[75vh]'}`}>
      <div className="relative flex items-center justify-center w-10 h-10">
        {/* Anillo de fondo sutil */}
        <div className="absolute inset-0 rounded-full border-[2px] border-slate-200/50 dark:border-stone-800/50"></div>
        
        {/* Spinner principal animado */}
        <div className="absolute inset-0 rounded-full border-[2px] border-orange-500 dark:border-orange-400 border-t-transparent dark:border-t-transparent animate-spin" style={{ animationDuration: '1s' }}></div>
        
        {/* Capa de resplandor sutil (glow) */}
        <div className="absolute inset-0 rounded-full bg-orange-500/20 dark:bg-orange-500/10 blur-xl scale-125 pointer-events-none"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
