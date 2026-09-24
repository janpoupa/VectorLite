import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, SquareDashed, Sun, Moon } from 'lucide-react';
import type { BackgroundMode } from '../types';

// ── Background icon ──────────────────────────────────────────────────────────

function BgIcon({ mode }: { mode: BackgroundMode }) {
  switch (mode) {
    case 'checkerboard': return <SquareDashed size={14} />;
    case 'white':        return <Sun size={14} />;
    case 'black':        return <Moon size={14} />;
  }
}

const BG_LABEL: Record<BackgroundMode, string> = {
  checkerboard: 'Transparent (B)',
  white:        'White background (B)',
  black:        'Black background (B)',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface FloatingBarProps {
  backgroundMode: BackgroundMode;
  onBackgroundToggle: () => void;
  onExportOpen: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  totalFiles: number;
  currentFileIndex: number;
  hasFile: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FloatingBar({
  backgroundMode,
  onBackgroundToggle,
  onExportOpen,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
  totalFiles,
  currentFileIndex,
  hasFile,
}: FloatingBarProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Auto-hide ─────────────────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2800);
  }, []);

  const revealBar = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    window.addEventListener('mousemove', revealBar);
    window.addEventListener('keydown', revealBar);
    scheduleHide();
    return () => {
      window.removeEventListener('mousemove', revealBar);
      window.removeEventListener('keydown', revealBar);
      clearTimeout(timerRef.current);
    };
  }, [revealBar, scheduleHide]);

  const handleBarEnter = () => { clearTimeout(timerRef.current); setVisible(true); };
  const handleBarLeave = () => scheduleHide();

  const hasFiles = totalFiles > 1;

  return (
    <div
      className={`
        absolute bottom-5 left-1/2 -translate-x-1/2
        transition-all duration-500 ease-in-out z-30
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}
      `}
      onMouseEnter={handleBarEnter}
      onMouseLeave={handleBarLeave}
    >
      <div
        className="
          floating-bar flex items-center gap-1 px-2.5 py-1.5
          bg-neutral-900/85 border border-white/[0.08]
          rounded-full shadow-2xl shadow-black/50
          text-white/70
        "
      >
        {/* ── Prev ─────────────────────────────────────────────────── */}
        {hasFiles && (
          <button
            onClick={onNavigatePrev}
            disabled={!hasPrev}
            title="Previous file (←)"
            className="
              flex items-center justify-center w-7 h-7 rounded-full
              hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed
              transition-colors
            "
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* ── Divider ───────────────────────────────────────────────── */}
        {hasFiles && (
          <div className="w-px h-4 bg-white/10 mx-0.5" />
        )}

        {/* ── Background toggle ────────────────────────────────────── */}
        <button
          onClick={onBackgroundToggle}
          title={BG_LABEL[backgroundMode]}
          className="
            flex items-center justify-center w-8 h-8 rounded-full
            hover:bg-white/10 transition-colors
          "
        >
          <BgIcon mode={backgroundMode} />
        </button>

        {/* ── Export (only when an SVG is loaded) ─────────────────── */}
        {hasFile && (
          <button
            onClick={onExportOpen}
            title="Export image…"
            className="
              flex items-center justify-center w-8 h-8 rounded-full
              hover:bg-white/10 transition-colors
            "
          >
            <Download size={14} />
          </button>
        )}

        {/* ── Divider + Next ────────────────────────────────────────── */}
        {hasFiles && (
          <>
            <div className="w-px h-4 bg-white/10 mx-0.5" />
            <button
              onClick={onNavigateNext}
              disabled={!hasNext}
              title="Next file (→)"
              className="
                flex items-center justify-center w-7 h-7 rounded-full
                hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed
                transition-colors
              "
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* ── File counter ─────────────────────────────────────────── */}
        {hasFiles && (
          <span className="text-white/25 text-[10px] tabular-nums ml-0.5 pr-0.5">
            {currentFileIndex + 1}/{totalFiles}
          </span>
        )}
      </div>
    </div>
  );
}
