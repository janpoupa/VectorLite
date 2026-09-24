import { useCallback, useEffect, useRef } from 'react';
import type { BackgroundMode, PanState } from '../types';

interface CanvasProps {
  imageSrc: string | null;
  backgroundMode: BackgroundMode;
  zoom: number;
  pan: PanState;
  onZoomChange: (zoom: number) => void;
  onPanChange: (pan: PanState) => void;
  fileName: string;
  fileError: string | null;
}

function getBackgroundStyle(mode: BackgroundMode): React.CSSProperties {
  switch (mode) {
    case 'checkerboard':
      return {
        backgroundImage: `
          linear-gradient(45deg, #323232 25%, transparent 25%),
          linear-gradient(-45deg, #323232 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #323232 75%),
          linear-gradient(-45deg, transparent 75%, #323232 75%)
        `.trim(),
        backgroundSize: '22px 22px',
        backgroundPosition: '0 0, 0 11px, 11px -11px, -11px 0px',
        backgroundColor: '#272727',
      };
    case 'white':
      return { backgroundColor: '#ffffff' };
    case 'black':
      return { backgroundColor: '#000000' };
    default:
      return {};
  }
}

// ── Empty / error states ────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="w-full h-full flex items-center justify-center select-none">
      <div className="text-center">
        <div className="relative mx-auto mb-5 w-20 h-20">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/15 to-indigo-600/10 border border-violet-500/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="opacity-50">
              <path d="M16 4L28 16L16 28L4 16L16 4Z" stroke="url(#g)" strokeWidth="2" strokeLinejoin="round" fill="none" />
              <defs>
                <linearGradient id="g" x1="4" y1="4" x2="28" y2="28">
                  <stop stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        <p className="text-white/40 text-sm font-medium">Drop an SVG or PDF file here</p>
        <p className="text-white/20 text-xs mt-1.5">
          or press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/40 text-[10px] font-mono">Ctrl+O</kbd> to browse
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center select-none">
      <div className="text-center max-w-sm px-6">
        <div className="text-3xl mb-3 opacity-60">⚠</div>
        <p className="text-white/50 text-sm font-medium mb-1">Failed to open file</p>
        <p className="text-red-400/70 text-xs leading-relaxed break-words">{message}</p>
      </div>
    </div>
  );
}

// ── Main Canvas ─────────────────────────────────────────────────────────────

export function Canvas({
  imageSrc,
  backgroundMode,
  zoom,
  pan,
  onZoomChange,
  onPanChange,
  fileError,
}: CanvasProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const isPanningRef  = useRef(false);
  const panStartRef   = useRef<PanState>({ x: 0, y: 0 });
  const panOriginRef  = useRef<PanState>({ x: 0, y: 0 });
  const zoomRef       = useRef(zoom);
  const panRef        = useRef(pan);

  // Keep refs in sync so event callbacks don't close over stale state
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // ── Mouse wheel zoom ──────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const next  = Math.min(Math.max(zoomRef.current * delta, 0.04), 32);
    onZoomChange(next);
  }, [onZoomChange]);

  // ── Middle-mouse / Alt+drag pan ───────────────────────────────────────────
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanningRef.current = true;
      panStartRef.current  = { x: e.clientX, y: e.clientY };
      panOriginRef.current = { ...panRef.current };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanningRef.current) return;
    onPanChange({
      x: panOriginRef.current.x + (e.clientX - panStartRef.current.x),
      y: panOriginRef.current.y + (e.clientY - panStartRef.current.y),
    });
  }, [onPanChange]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // ── Double-click to reset view ────────────────────────────────────────────
  const handleDoubleClick = useCallback(() => {
    onZoomChange(1);
    onPanChange({ x: 0, y: 0 });
  }, [onZoomChange, onPanChange]);

  // ── Attach / detach event listeners ──────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (fileError) return <ErrorState message={fileError} />;
  if (!imageSrc) return <EmptyState />;

  const bgStyle = getBackgroundStyle(backgroundMode);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden flex items-center justify-center"
      style={bgStyle}
      onDoubleClick={handleDoubleClick}
    >
      {/*
        Transform wrapper: only the media is zoomed/panned, not the whole
        background. The background pattern stays fixed in place.
      */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          willChange: 'transform',
          lineHeight: 0,
          flexShrink: 0,
        }}
      >
        <img
          src={imageSrc}
          alt=""
          draggable={false}
          style={{
            display: 'block',
            width: '85vw',
            height: '80vh',
            objectFit: 'contain',
            objectPosition: 'center',
            imageRendering: 'auto',
            userSelect: 'none',
            cursor: isPanningRef.current ? 'grabbing' : 'default',
          }}
        />
      </div>
    </div>
  );
}
