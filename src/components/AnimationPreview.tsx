import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, Sliders } from 'lucide-react';

interface AnimationPreviewProps {
  sheetSrc: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  sheetWidth?: number;
  sheetHeight?: number;
  initialFps?: number;
  onFpsChange?: (fps: number) => void;
}

function computeIntegerScale(frameW: number, frameH: number, maxW = 256, maxH = 256): number {
  if (frameW <= 0 || frameH <= 0) return 1;

  const fitScale = Math.min(maxW / frameW, maxH / frameH);
  if (fitScale >= 1) {
    return Math.max(1, Math.min(8, Math.floor(fitScale)));
  }
  return Math.max(1, Math.floor(fitScale));
}

export default function AnimationPreview({
  sheetSrc,
  frameCount,
  frameWidth,
  frameHeight,
  sheetWidth,
  sheetHeight,
  initialFps = 10,
  onFpsChange,
}: AnimationPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState(initialFps);
  const [loop, setLoop] = useState(true);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setFps(initialFps);
  }, [initialFps]);

  useEffect(() => {
    if (!sheetSrc) {
      setNaturalSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setNaturalSize(null);
    img.src = sheetSrc;
  }, [sheetSrc]);

  const metrics = useMemo(() => {
    const count = Math.max(1, frameCount);
    const cols = 4;
    const rows = Math.max(4, Math.ceil(count / cols));
    const sheetW = naturalSize?.w || sheetWidth || frameWidth * cols;
    const sheetH = naturalSize?.h || sheetHeight || frameHeight * rows;
    const fw = naturalSize ? Math.round(sheetW / cols) : frameWidth;
    const fh = naturalSize ? Math.round(sheetH / rows) : frameHeight;
    const scale = computeIntegerScale(fw, fh);
    return { fw, fh, sheetW, sheetH, scale, count, cols };
  }, [naturalSize, sheetWidth, sheetHeight, frameWidth, frameHeight, frameCount]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isPlaying || frameCount <= 0 || !sheetSrc) return;

    const intervalMs = Math.max(16, Math.round(1000 / fps));
    timerRef.current = window.setInterval(() => {
      setCurrentFrame((prev) => {
        const next = prev + 1;
        if (next >= frameCount) {
          if (loop) return 0;
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, frameCount, fps, loop, sheetSrc]);

  useEffect(() => {
    setCurrentFrame(0);
  }, [sheetSrc, frameCount]);

  const handleTogglePlay = () => {
    if (currentFrame >= frameCount - 1 && !isPlaying) {
      setCurrentFrame(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleFpsSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setFps(val);
    onFpsChange?.(val);
  };

  const hasAnimation = Boolean(sheetSrc && frameCount > 0 && naturalSize);

  const viewportW = metrics.fw * metrics.scale;
  const viewportH = metrics.fh * metrics.scale;
  const sheetDisplayW = metrics.sheetW * metrics.scale;
  const sheetDisplayH = metrics.sheetH * metrics.scale;
  
  const col = currentFrame % metrics.cols;
  const row = Math.floor(currentFrame / metrics.cols);
  const offsetX = col * metrics.fw * metrics.scale;
  const offsetY = row * metrics.fh * metrics.scale;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
          Animation Preview
        </label>
        <span className="font-mono text-[9px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-indigo-400">
          {frameCount > 0 ? `Frame ${currentFrame + 1}/${frameCount}` : 'No Frames'}
        </span>
      </div>

      <div className="relative h-60 bg-slate-950 rounded flex items-center justify-center overflow-hidden transparent-grid border border-slate-900">
        {hasAnimation ? (
          <div
            className="relative shrink-0 overflow-hidden"
            style={{ width: viewportW, height: viewportH }}
          >
            <img
              src={sheetSrc}
              alt={`Animation frame ${currentFrame + 1}`}
              draggable={false}
              className="pixelated absolute top-0 left-0 max-w-none select-none"
              style={{
                width: sheetDisplayW,
                height: sheetDisplayH,
                transform: `translate3d(-${offsetX}px, -${offsetY}px, 0)`,
                willChange: 'transform',
              }}
            />
          </div>
        ) : sheetSrc && frameCount > 0 ? (
          <div className="text-[10px] text-slate-500 font-mono">Loading sheet…</div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 text-slate-500 max-w-xs">
            <Sliders className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs font-semibold text-slate-400">No Active Sheet Compile</p>
            <p className="text-[10px] text-slate-500 mt-1">Stitch frames above to preview playback loops.</p>
          </div>
        )}
      </div>

      {hasAnimation && (
        <p className="text-[9px] font-mono text-slate-500 text-center -mt-2">
          {metrics.fw}×{metrics.fh}px frame · {metrics.scale}× scale · {fps} FPS
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTogglePlay}
              disabled={!hasAnimation}
              className={`p-2 rounded flex items-center justify-center transition-colors ${
                isPlaying
                  ? 'bg-amber-600/15 hover:bg-amber-600/35 text-amber-400'
                  : 'bg-indigo-600/15 hover:bg-indigo-600/35 text-indigo-400'
              } disabled:opacity-40 disabled:pointer-events-none cursor-pointer`}
              title={isPlaying ? 'Pause Preview' : 'Play Preview'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setCurrentFrame(0)}
              disabled={!hasAnimation}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
              title="Reset Frame"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-400 select-none">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className="rounded bg-slate-850 border-slate-700 text-indigo-500 w-3.5 h-3.5 cursor-pointer"
            />
            Loop Animation
          </label>
        </div>

        <div className="bg-slate-950 p-3 rounded border border-slate-900">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">FPS Control</span>
            <span className="font-mono text-xs font-bold text-indigo-400">{fps} FPS</span>
          </div>
          <input
            type="range"
            min="1"
            max="60"
            value={fps}
            onChange={handleFpsSlider}
            disabled={!hasAnimation}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500 disabled:opacity-45"
          />
        </div>
      </div>
    </div>
  );
}
