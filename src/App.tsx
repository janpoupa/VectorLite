import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TitleBar } from './components/TitleBar';
import { Canvas } from './components/Canvas';
import { FloatingBar } from './components/FloatingBar';
import { ExportDialog } from './components/ExportDialog';
import type { BackgroundMode, FilePayload } from './types';
import { prepareForDisplay } from './utils/colors';
import { renderPdfToDataUrl } from './utils/pdf';

const BG_CYCLE: BackgroundMode[] = ['checkerboard', 'white', 'black'];

export default function App() {
  // ── File state ────────────────────────────────────────────────────────────
  const [fileName, setFileName]               = useState<string>('');
  const [imageSrc, setImageSrc]               = useState<string | null>(null);
  const [rawSvg, setRawSvg]                   = useState<string | null>(null);
  const [siblingFiles, setSiblingFiles]       = useState<string[]>([]);
  const [currentIndex, setCurrentIndex]       = useState<number>(-1);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('checkerboard');
  const [zoom, setZoom]                     = useState(1);
  const [pan, setPan]                       = useState({ x: 0, y: 0 });
  const [isExportOpen, setIsExportOpen]     = useState(false);
  const [fileError, setFileError]           = useState<string | null>(null);

  // Keep track of active blob URL to clean up memory
  const prevBlobUrlRef = useRef<string | null>(null);

  // ── File loading ──────────────────────────────────────────────────────────
  const loadFile = useCallback(async (path: string, direction?: number) => {
    setFileError(null);

    // Clean up previous blob URL if exists
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }

    try {
      const payload = await invoke<FilePayload>('load_file', { path });

      setFileName(payload.name);
      setZoom(1);
      setPan({ x: 0, y: 0 });

      if (payload.view_type === 'svg') {
        const prepared = prepareForDisplay(payload.content);
        const blob = new Blob([prepared], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        prevBlobUrlRef.current = url;
        setImageSrc(url);
        setRawSvg(prepared);
      } else {
        // "pdf" — render page 1 using pdfjs-dist
        const pngUrl = await renderPdfToDataUrl(payload.content);
        setImageSrc(pngUrl);
        setRawSvg(null);
      }

      loadSiblings(path);
    } catch (err) {
      // If navigating through folder and a file cannot be previewed, auto-advance/skip it
      if (direction !== undefined) {
        setSiblingFiles((currentSiblings) => {
          const normPath = path.replace(/\\/g, '/').toLowerCase();
          const cur = currentSiblings.findIndex(
            (s) => s.replace(/\\/g, '/').toLowerCase() === normPath,
          );
          const nextIdx = cur + direction;
          if (nextIdx >= 0 && nextIdx < currentSiblings.length) {
            loadFile(currentSiblings[nextIdx], direction);
          }
          return currentSiblings;
        });
        return;
      }

      setFileError(String(err));
      setImageSrc(null);
      setRawSvg(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSiblings = useCallback(async (path: string) => {
    try {
      const siblings = await invoke<string[]>('list_siblings', { path });
      setSiblingFiles(siblings);
      const normPath = path.replace(/\\/g, '/').toLowerCase();
      const idx = siblings.findIndex(
        (s) => s.replace(/\\/g, '/').toLowerCase() === normPath,
      );
      setCurrentIndex(idx);
    } catch (err) {
      console.warn('list_siblings failed:', err);
      setSiblingFiles([path]);
      setCurrentIndex(0);
    }
  }, []);

  // ── On mount: CLI arg + file drop listener ────────────────────────────────
  useEffect(() => {
    invoke<string | null>('get_initial_file').then((path) => {
      if (path) loadFile(path);
    });
  }, [loadFile]);

  useEffect(() => {
    const SUPPORTED = /\.(svg|pdf)$/i;
    const handlePaths = (paths: string[]) => {
      const hit = paths.find((p) => SUPPORTED.test(p));
      if (hit) loadFile(hit);
    };

    let unlisten1: (() => void) | undefined;
    let unlisten2: (() => void) | undefined;

    listen<{ paths: string[] }>('tauri://file-drop', (e) => {
      handlePaths(e.payload?.paths ?? []);
    }).then((fn) => { unlisten1 = fn; }).catch(() => {});

    listen<{ paths: string[] }>('tauri://drag-drop', (e) => {
      handlePaths(e.payload?.paths ?? []);
    }).then((fn) => { unlisten2 = fn; }).catch(() => {});

    const preventNav = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventNav);
    window.addEventListener('drop', preventNav);

    return () => {
      unlisten1?.();
      unlisten2?.();
      window.removeEventListener('dragover', preventNav);
      window.removeEventListener('drop', preventNav);
    };
  }, [loadFile]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (index: number, direction: number) => {
      if (index >= 0 && index < siblingFiles.length) {
        setCurrentIndex(index);
        loadFile(siblingFiles[index], direction);
      }
    },
    [siblingFiles, loadFile],
  );

  const handlePrev = useCallback(() => navigateTo(currentIndex - 1, -1), [currentIndex, navigateTo]);
  const handleNext = useCallback(() => navigateTo(currentIndex + 1, 1), [currentIndex, navigateTo]);

  // ── Background ────────────────────────────────────────────────────────────
  const toggleBackground = useCallback(() => {
    setBackgroundMode((prev) => BG_CYCLE[(BG_CYCLE.indexOf(prev) + 1) % BG_CYCLE.length]);
  }, []);

  // ── Open file dialog using native Rust rfd ─────────────────────────────────
  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await invoke<string | null>('pick_file_dialog');
      if (selected) loadFile(selected);
    } catch (err) {
      console.error('Open dialog failed:', err);
    }
  }, [loadFile]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const isTypingRef = useRef(false);

  useEffect(() => {
    const onFocusIn = () => {
      const el = document.activeElement;
      isTypingRef.current =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', () => { isTypingRef.current = false; });
    return () => {
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingRef.current) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          toggleBackground();
          break;
        case 'Escape':
          setIsExportOpen(false);
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }
          break;
        case 'o':
        case 'O':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleOpenFile();
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePrev, handleNext, toggleBackground, handleOpenFile]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col w-screen h-screen bg-neutral-950 overflow-hidden rounded-xl">
      <TitleBar
        fileName={fileName}
        onOpenFile={handleOpenFile}
      />

      <div className="flex-1 relative overflow-hidden">
        <Canvas
          imageSrc={imageSrc}
          backgroundMode={backgroundMode}
          zoom={zoom}
          pan={pan}
          onZoomChange={setZoom}
          onPanChange={setPan}
          fileName={fileName}
          fileError={fileError}
        />

        <FloatingBar
          backgroundMode={backgroundMode}
          onBackgroundToggle={toggleBackground}
          onExportOpen={() => setIsExportOpen(true)}
          onNavigatePrev={handlePrev}
          onNavigateNext={handleNext}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex < siblingFiles.length - 1}
          totalFiles={siblingFiles.length}
          currentFileIndex={currentIndex}
          hasFile={!!imageSrc}
        />
      </div>

      {isExportOpen && (
        <ExportDialog
          svgContent={rawSvg}
          imageSrc={imageSrc}
          fileName={fileName}
          backgroundMode={backgroundMode}
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </div>
  );
}
