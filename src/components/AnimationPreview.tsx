import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Sliders } from 'lucide-react';

interface AnimationPreviewProps {
  sheetSrc: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  initialFps?: number;
  onFpsChange?: (fps: number) => void;
}

export default function AnimationPreview({
  sheetSrc,
  frameCount,
  frameWidth,
  frameHeight,
  initialFps = 10,
  onFpsChange
}: AnimationPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState(initialFps);
  const [loop, setLoop] = useState(true);
  
  const timerRef = useRef<number | null>(null);

  // Sync FPS if initial changes
  useEffect(() => {
    setFps(initialFps);
  }, [initialFps]);

  // Handle animation frame calculation
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isPlaying || frameCount <= 0 || !sheetSrc) {
      return;
    }

    const intervalMs = 1000 / fps;
    timerRef.current = window.setInterval(() => {
      setCurrentFrame((prev) => {
        const next = prev + 1;
        if (next >= frameCount) {
          if (loop) {
            return 0;
          } else {
            setIsPlaying(false);
            return prev; // stop at last frame
          }
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, frameCount, fps, loop, sheetSrc]);

  // Reset frame when source sheet or count changes
  useEffect(() => {
    setCurrentFrame(0);
  }, [sheetSrc, frameCount]);

  const handleTogglePlay = () => {
    if (currentFrame >= frameCount - 1 && !isPlaying) {
      setCurrentFrame(0); // restart if stopped on last frame
    }
    setIsPlaying(!isPlaying);
  };

  const handleFpsSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setFps(val);
    if (onFpsChange) {
      onFpsChange(val);
    }
  };

  const hasAnimation = sheetSrc && frameCount > 0;

  // Let's compute a container size that fits the frame of the preview beautifully,
  // preventing giant previews from scaling infinitely or tiny ones from blowing up awkwardly.
  const previewMaxHeight = 256; 
  const previewMaxWidth = 256; 
  
  let scale = 1;
  if (frameWidth > previewMaxWidth || frameHeight > previewMaxHeight) {
    scale = Math.min(previewMaxWidth / frameWidth, previewMaxHeight / frameHeight);
  } else if (frameWidth < 64 && frameHeight < 64) {
    scale = 4; // Integer scaling for pixel art feel!
  } else if (frameWidth < 128 && frameHeight < 128) {
    scale = 2; // integer scale for clarity
  }

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
 
      {/* Frame Visual Stage */}
      <div className="relative h-60 bg-slate-950 rounded flex items-center justify-center overflow-hidden transparent-grid border border-slate-900">
        {hasAnimation ? (
          <div 
            className="pixelated transition-all"
            style={{
              width: `${frameWidth}px`,
              height: `${frameHeight}px`,
              backgroundImage: `url(${sheetSrc})`,
              backgroundPosition: `-${currentFrame * frameWidth}px 0px`,
              backgroundSize: `${frameWidth * frameCount}px ${frameHeight}px`,
              transform: `scale(${scale})`,
              imageRendering: 'pixelated'
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 text-slate-500 max-w-xs">
            <Sliders className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs font-semibold text-slate-450">No Active Sheet Compile</p>
            <p className="text-[10px] text-slate-550 mt-1">Stitch frames above to preview playback loops.</p>
          </div>
        )}
      </div>
 
      {/* Control Actions / Playback */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTogglePlay}
              disabled={!hasAnimation}
              className={`p-2 rounded flex items-center justify-center transition-all ${
                isPlaying 
                  ? 'bg-amber-600/15 hover:bg-amber-600/35 text-amber-400' 
                  : 'bg-indigo-600/15 hover:bg-indigo-600/35 text-indigo-400'
              } disabled:opacity-40 disabled:pointer-events-none cursor-pointer`}
              title={isPlaying ? "Pause Preview" : "Play Preview"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setCurrentFrame(0)}
              disabled={!hasAnimation}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
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
 
        {/* FPS Control Slider */}
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
