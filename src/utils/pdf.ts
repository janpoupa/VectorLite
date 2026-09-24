import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using standard Vite asset URL resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * Renders the first page of a PDF (passed as a data URL or raw base64)
 * to a high-resolution PNG data URL using PDF.js.
 */
export async function renderPdfToDataUrl(pdfDataUrl: string): Promise<string> {
  const base64Data = pdfDataUrl.includes(',')
    ? pdfDataUrl.split(',')[1]
    : pdfDataUrl;

  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // Render at high resolution (up to 2000px) for crisp vector-like display
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const targetScale = Math.min(
    Math.max(2000 / Math.max(unscaledViewport.width, unscaledViewport.height), 1.5),
    3.0,
  );
  const viewport = page.getViewport({ scale: targetScale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  return canvas.toDataURL('image/png');
}
