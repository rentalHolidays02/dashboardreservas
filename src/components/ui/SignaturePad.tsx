import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, PenLine } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  value?: string;           // base64 o URL existente
  onChange: (base64: string) => void;
  readOnly?: boolean;
}

const isDisplayableSignature = (v?: string) => {
  const s = v?.trim();
  if (!s) return false;
  return s.startsWith('data:image/') || /^https?:\/\//i.test(s);
};

const SignaturePad: React.FC<SignaturePadProps> = ({ label, value, onChange, readOnly }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedExternalIntoCanvas = useRef(false);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(() => isDisplayableSignature(value));
  const [imgError, setImgError] = useState(false);
  const [imgSrc, setImgSrc] = useState(() => (isDisplayableSignature(value) ? value!.trim() : ''));
  // Bloqueo en edición: si el componente recibe una firma ya guardada al montarse,
  // la mostramos como imagen y bloqueamos el lienzo hasta que el usuario pulse "Limpiar".
  const [locked, setLocked] = useState(() => !readOnly && isDisplayableSignature(value));
  const [lockMsgVisible, setLockMsgVisible] = useState(false);
  const lockMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const showLockedMsg = () => {
    setLockMsgVisible(true);
    if (lockMsgTimer.current) clearTimeout(lockMsgTimer.current);
    lockMsgTimer.current = setTimeout(() => setLockMsgVisible(false), 2500);
  };

  const displayUrl = isDisplayableSignature(value) ? value!.trim() : '';

  useEffect(() => {
    const displayable = isDisplayableSignature(value);
    setImgError(false);
    setHasContent(displayable);
    setImgSrc(displayable ? value!.trim() : '');
    if (!readOnly && displayable) setLocked(true);
    else if (!displayable) setLocked(false);
  }, [value, readOnly]);

  useEffect(() => {
    if (!value || readOnly || !canvasRef.current) return;
    if (!value.startsWith('data:image/')) {
      // Evita CORS con imágenes externas (Drive) al dibujar sobre canvas.
      loadedExternalIntoCanvas.current = true;
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHasContent(true);
      loadedExternalIntoCanvas.current = false;
    };
    img.onerror = () => {
      setHasContent(false);
      loadedExternalIntoCanvas.current = false;
    };
    img.src = value;
  }, [value, readOnly]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // touchmove con passive:false para que e.preventDefault() funcione y no scroll mientras se firma
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: TouchEvent) => {
      if (!drawing || readOnly) return;
      e.preventDefault();
      draw(e as unknown as React.TouchEvent);
    };
    canvas.addEventListener('touchmove', handler, { passive: false });
    return () => canvas.removeEventListener('touchmove', handler);
  }, [drawing, readOnly]);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ('touches' in e) {
        const t = e.touches[0];
        return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
      }
      const me = e as React.MouseEvent;
      return { x: (me.clientX - rect.left) * scaleX, y: (me.clientY - rect.top) * scaleY };
    },
    []
  );

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    if (locked) {
      // Firma ya guardada — bloqueada hasta que se pulse "Limpiar".
      e.preventDefault();
      showLockedMsg();
      return;
    }
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (loadedExternalIntoCanvas.current) {
      // Resetea canvas para evitar "tainted canvas" en toDataURL().
      canvas.width = canvas.width;
      loadedExternalIntoCanvas.current = false;
      setHasContent(false);
    }
    setDrawing(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    lastPos.current = pos;
    setHasContent(true);
  };

  const stopDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas && hasContent) {
      try {
        onChange(canvas.toDataURL('image/png'));
      } catch {
        // Si el canvas fue contaminado por una imagen externa, no rompemos la UI.
      }
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setLocked(false);              // desbloquea para permitir dibujar uno nuevo
    setLockMsgVisible(false);
    setHasContent(false);
    onChange('');
  };

  const showPlaceholder = !hasContent || (readOnly && imgError);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-stone-400">
          <PenLine size={11} className="text-orange-400" />
          {label}
        </label>
        {!readOnly && hasContent && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-400 transition-colors"
          >
            <RotateCcw size={10} /> Limpiar
          </button>
        )}
      </div>

      <div
        style={{ touchAction: 'none', backgroundColor: '#ffffff' }}
        className={`relative rounded-xl overflow-hidden border-2 transition-colors
          ${readOnly
            ? 'border-stone-200/60 dark:border-stone-700/50'
            : drawing
              ? 'border-orange-400 dark:border-orange-500'
              : 'border-dashed border-orange-300/70 dark:border-orange-800/50 hover:border-orange-400 dark:hover:border-orange-600'
          }`}
      >
        {(readOnly || locked) && imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={label}
            referrerPolicy="no-referrer"
            onClick={locked && !readOnly ? showLockedMsg : undefined}
            onTouchStart={locked && !readOnly ? (e) => { e.preventDefault(); showLockedMsg(); } : undefined}
            className={`w-full block object-contain ${locked && !readOnly ? 'cursor-not-allowed' : ''}`}
            style={{ height: 110, backgroundColor: '#ffffff' }}
            onLoad={() => setHasContent(true)}
            onError={() => {
              const id = imgSrc.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/)?.[1];
              const thumb = id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : '';
              if (thumb && imgSrc !== thumb) {
                setImgSrc(thumb);
                return;
              }
              setImgError(true);
              setHasContent(false);
            }}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={600}
            height={180}
            className={`w-full block ${readOnly ? 'cursor-default' : 'cursor-crosshair'}`}
            style={{ height: 110, backgroundColor: '#ffffff' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchEnd={stopDraw}
          />
        )}
        {lockMsgVisible && (
          <div className="absolute inset-x-2 bottom-2 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] text-center shadow font-medium animate-in fade-in slide-in-from-bottom-1 duration-200">
            No se puede editar la firma. Pulsa "Limpiar" para hacer una nueva.
          </div>
        )}
        {showPlaceholder && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[11px] text-slate-300 dark:text-slate-400">
              {readOnly
                ? imgError
                  ? 'No se pudo cargar la firma'
                  : 'Sin firma registrada'
                : 'Firmar aquí...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignaturePad;
