import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, X, Loader } from 'lucide-react';
import type { BackgroundMode } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'png' | 'jpg' | 'webp';
type SizePreset   = '500' | '1500' | 'custom';

interface ExportDialogProps {
  svgContent: string | null;
  imageSrc: string | null;
  fileName: string;
  backgroundMode: BackgroundMode;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveExportBg(mode: BackgroundMode, format: ExportFormat): string | null {
  const isPng = format === 'png';
  switch (mode) {
    case 'white':        return '#ffffff';
    case 'black':        return '#000000';
    case 'checkerboard': return isPng ? null : '#ffffff';
  }
}

function parseSvgAspect(svg: string | null): number {
  if (!svg) return 1;
  const vb = svg.match(/viewBox\s*=\s*["']\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*["']/);
  if (vb) {
    const w = parseFloat(vb[3]);
    const h = parseFloat(vb[4]);
    if (w > 0 && h > 0) return w / h;
  }
  const ww = svg.match(/<svg[^>]*\bwidth\s*=\s*["'](\d+\.?\d*)/);
  const wh = svg.match(/<svg[^>]*\bheight\s*=\s*["'](\d+\.?\d*)/);
  if (ww && wh) {
    const w = parseFloat(ww[1]);
    const h = parseFloat(wh[1]);
    if (w > 0 && h > 0) return w / h;
  }
  return 1;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExportDialog({
  svgContent,
  imageSrc,
  fileName,
  backgroundMode,
  onClose,
}: ExportDialogProps) {
  const [format, setFormat]           = useState<ExportFormat>('png');
  const [sizePreset, setSizePreset]   = useState<SizePreset>('1500');
  const [customWidth, setCustomWidth] = useState<number>(2000);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [rasterAspect, setRasterAspect] = useState<number>(1);

  // Measure aspect ratio of raster image if not SVG
  useEffect(() => {
    if (!svgContent && imageSrc) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setRasterAspect(img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = imageSrc;
    }
  }, [svgContent, imageSrc]);

  const aspect = svgContent ? parseSvgAspect(svgContent) : rasterAspect;
  const targetWidth = sizePreset === 'custom' ? customWidth : parseInt(sizePreset, 10);
  const targetHeight = Math.max(1, Math.round(targetWidth / (aspect || 1)));
  const stemName = fileName.replace(/\.[^.]+$/, '') || 'export';

  const handleExport = async () => {
    if (!svgContent && !imageSrc) return;
    setErrorMsg(null);
    setIsExporting(true);

    try {
      // Open native save dialog via Rust rfd
      const savePath = await invoke<string | null>('pick_save_dialog', {
        defaultName: `${stemName}.${format}`,
        format,
      });

      if (!savePath) {
        setIsExporting(false);
        return;
      }

      if (svgContent) {
        // High-precision vector rasterization using resvg in Rust
        await invoke('export_image', {
          options: {
            svgContent,
            format,
            width: targetWidth,
            outputPath: savePath,
            backgroundColor: resolveExportBg(backgroundMode, format),
          },
        });
      } else if (imageSrc) {
        // High-resolution canvas export for PDF
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image for export'));
          img.src = imageSrc;
        });

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        // Draw background
        const bgColor = resolveExportBg(backgroundMode, format);
        if (bgColor) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const mime = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp';
        const dataUrl = canvas.toDataURL(mime, 0.95);

        await invoke('save_binary_file', {
          outputPath: savePath,
          base64Data: dataUrl,
        });
      }

      onClose();
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative bg-neutral-900 border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <Download size={15} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-white/90 text-sm font-semibold">Export Image</h2>
              <p className="text-white/30 text-[11px] mt-0.5 truncate max-w-[180px]">
                {fileName || 'untitled'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Format */}
          <div>
            <label className="text-white/40 text-[11px] uppercase tracking-wider font-medium mb-2 block">
              Format
            </label>
            <div className="flex gap-1.5">
              {(['png', 'jpg', 'webp'] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`
                    flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide border transition-colors
                    ${format === f
                      ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/30'
                      : 'bg-white/[0.03] border-white/[0.06] text-white/45 hover:bg-white/[0.07] hover:text-white/70'
                    }
                  `}
                >
                  {f}
                </button>
              ))}
            </div>
            {format === 'jpg' && (
              <p className="text-white/25 text-[10px] mt-1.5">
                JPEG doesn't support transparency — transparent areas become white.
              </p>
            )}
          </div>

          {/* Size */}
          <div>
            <label className="text-white/40 text-[11px] uppercase tracking-wider font-medium mb-2 block">
              Size
            </label>
            <div className="flex gap-1.5 mb-3">
              {([['500', '500 px'], ['1500', '1500 px'], ['custom', 'Custom']] as [SizePreset, string][]).map(
                ([p, label]) => (
                  <button
                    key={p}
                    onClick={() => setSizePreset(p)}
                    className={`
                      flex-1 py-2 rounded-xl text-xs font-medium border transition-colors
                      ${sizePreset === p
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/45 hover:bg-white/[0.07] hover:text-white/70'
                      }
                    `}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            {sizePreset === 'custom' && (
              <div className="flex items-center gap-2 bg-neutral-800 rounded-xl px-3 py-2 border border-white/[0.06]">
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0) setCustomWidth(Math.min(v, 16384));
                  }}
                  min={1}
                  max={16384}
                  className="flex-1 bg-transparent text-white/80 text-sm font-mono outline-none"
                />
                <span className="text-white/25 text-xs">px wide</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-2.5 text-white/30 text-[11px]">
              <span>Output dimensions</span>
              <span className="font-mono text-white/50">
                {targetWidth} × {targetHeight}
              </span>
            </div>
          </div>

          {/* Background note */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2.5 flex items-start gap-2">
            <div
              className="w-4 h-4 rounded-sm mt-0.5 flex-shrink-0 border border-white/10"
              style={
                backgroundMode === 'checkerboard'
                  ? {
                      backgroundImage: 'linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%)',
                      backgroundSize: '6px 6px',
                      backgroundPosition: '0 0,0 3px,3px -3px,-3px 0px',
                      backgroundColor: '#333',
                    }
                  : { backgroundColor: backgroundMode === 'white' ? '#fff' : '#000' }
              }
            />
            <p className="text-white/30 text-[11px] leading-relaxed">
              {backgroundMode === 'checkerboard' && format === 'png'
                ? 'Transparent background (PNG alpha channel preserved)'
                : backgroundMode === 'checkerboard'
                ? 'Transparent areas replaced with white for non-PNG formats'
                : `Solid ${backgroundMode} background`}
            </p>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <p className="text-red-400 text-[11px] leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={isExporting || (!svgContent && !imageSrc)}
            className="
              w-full flex items-center justify-center gap-2 h-11 rounded-xl
              font-semibold text-sm text-white
              bg-gradient-to-r from-violet-600 to-indigo-600
              hover:from-violet-500 hover:to-indigo-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all shadow-lg shadow-violet-900/30
            "
          >
            {isExporting
              ? <><Loader size={15} className="animate-spin" /> Exporting…</>
              : <><Download size={15} /> Export {format.toUpperCase()}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
