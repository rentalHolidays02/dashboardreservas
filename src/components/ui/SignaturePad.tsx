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
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const displayUrl = isDisplayableSignature(value) ? value!.trim() : '';

  useEffect(() => {
    setImgError(false);
    setHasContent(isDisplayableSignature(value));
    setImgSrc(isDisplayableSignature(value) ? value!.trim() : '');
  }, [value]);

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
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
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
        style={{ touchAction: 'none' }}
        className={`relative rounded-xl overflow-hidden border-2 bg-white dark:bg-stone-950 transition-colors
          ${readOnly
            ? 'border-stone-200/60 dark:border-stone-700/50'
            : drawing
              ? 'border-orange-400 dark:border-orange-500'
              : 'border-dashed border-orange-300/70 dark:border-orange-800/50 hover:border-orange-400 dark:hover:border-orange-600'
          }`}
      >
        {readOnly && imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={label}
            referrerPolicy="no-referrer"
            className="w-full block object-contain bg-white dark:bg-stone-950"
            style={{ height: 110 }}
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
            style={{ height: 110 }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        )}
        {showPlaceholder && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[11px] text-slate-300 dark:text-stone-700">
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
