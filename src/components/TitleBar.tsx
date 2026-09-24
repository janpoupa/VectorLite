import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FolderOpen, Minus, X, Square, Maximize2 } from 'lucide-react';

interface TitleBarProps {
  fileName: string;
  onOpenFile: () => void;
}

export function TitleBar({ fileName, onOpenFile }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Sync maximized state
    appWindow.isMaximized().then(setIsMaximized);

    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [appWindow]);

  return (
    <div
      data-tauri-drag-region
      className="
        flex items-center h-9 flex-shrink-0 select-none
        bg-neutral-900/95 border-b border-white/[0.06]
      "
    >
      {/* ── App identity + filename ──────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 flex-1 min-w-0 px-3"
      >
        {/* App title */}
        <span
          data-tauri-drag-region
          className="text-white/35 text-[11px] font-semibold tracking-wider uppercase"
        >
          VectorLite
        </span>

        {fileName && (
          <>
            <span data-tauri-drag-region className="text-white/15 text-xs">›</span>
            <span
              data-tauri-drag-region
              className="text-white/60 text-[11px] truncate max-w-[280px]"
            >
              {fileName}
            </span>
          </>
        )}
      </div>

      {/* ── Open file button ────────────────────────────────────────── */}
      <button
        onClick={onOpenFile}
        title="Open file (Ctrl+O)"
        className="
          flex items-center justify-center w-8 h-8 rounded-md mr-1
          text-white/35 hover:text-white/80 hover:bg-white/[0.06]
          transition-colors duration-100
        "
      >
        <FolderOpen size={13} />
      </button>

      {/* ── Windows-style window controls (right) ───────────────────── */}
      <div className="flex items-center h-full">
        <button
          onClick={() => appWindow.minimize()}
          aria-label="Minimize"
          className="
            w-[46px] h-9 flex items-center justify-center
            text-white/40 hover:text-white hover:bg-white/[0.08]
            transition-colors duration-100
          "
        >
          <Minus size={11} strokeWidth={2} />
        </button>

        <button
          onClick={() => appWindow.toggleMaximize()}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          className="
            w-[46px] h-9 flex items-center justify-center
            text-white/40 hover:text-white hover:bg-white/[0.08]
            transition-colors duration-100
          "
        >
          {isMaximized
            ? <Square size={10} strokeWidth={2} />
            : <Maximize2 size={11} strokeWidth={2} />}
        </button>

        <button
          onClick={() => appWindow.close()}
          aria-label="Close"
          className="
            w-[46px] h-9 flex items-center justify-center rounded-tr-xl
            text-white/40 hover:text-white hover:bg-red-600
            transition-colors duration-100
          "
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
