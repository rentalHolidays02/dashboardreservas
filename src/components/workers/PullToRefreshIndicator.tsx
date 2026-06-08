import React from 'react';
import { Loader2 } from 'lucide-react';
import { PTR_THRESHOLD } from '../../hooks/usePullToRefresh';

interface Props {
  pullY: number;
  refreshing: boolean;
  dragging: boolean;
}

const SPINNER_SIZE = 22;
// Offset extra hacia abajo: separa el spinner del borde superior del contenido.
const VERTICAL_OFFSET = 8;

// Indicador centrado verticalmente en el hueco revelado por el pull (con leve offset).
// Wheel gris, sin fondo, con backdrop-blur para efecto suave.
const PullToRefreshIndicator: React.FC<Props> = ({ pullY, refreshing, dragging }) => {
  const settling = !dragging && !refreshing;
  const visualY = refreshing ? 60 : pullY;
  // Centrar el spinner dentro del hueco: la mitad del hueco menos la mitad del spinner + offset.
  const translate = visualY / 2 - SPINNER_SIZE / 2 + VERTICAL_OFFSET;
  const spinning = refreshing || pullY >= PTR_THRESHOLD;

  return (
    <div
      aria-hidden={!refreshing && pullY === 0}
      className="absolute left-0 right-0 top-0 flex items-center justify-center pointer-events-none z-10"
      style={{
        height: 0,
        transform: `translateY(${translate}px)`,
        opacity: refreshing ? 1 : Math.min(pullY / PTR_THRESHOLD, 1),
        transition: settling
          ? 'transform 360ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease-out'
          : 'none',
      }}
    >
      <div className="backdrop-blur-md rounded-full p-1.5">
        <Loader2
          size={SPINNER_SIZE}
          className={`text-stone-400 dark:text-stone-500 ${spinning ? 'animate-spin' : ''}`}
          style={spinning ? undefined : { transform: `rotate(${pullY * 4}deg)` }}
        />
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
