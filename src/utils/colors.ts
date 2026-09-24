// ─── SVG preprocessing ────────────────────────────────────────────────────────

/**
 * Ensures an SVG string has a `viewBox` attribute so browsers can infer its
 * intrinsic aspect ratio. Never removes or changes `width`/`height` attributes.
 * The SVG is displayed via a blob URL in an <img objectFit="contain"> so we
 * only need the viewBox present for correct aspect ratio detection.
 */
export function prepareForDisplay(svgContent: string): string {
  // Already has viewBox — nothing to do
  if (/viewBox\s*=\s*["'][^"']+["']/.test(svgContent)) return svgContent;

  // Try to synthesize viewBox from width/height in the opening <svg> tag.
  // Slice up to the first `>` to avoid matching child elements (multiline-safe).
  const svgOpenEnd = svgContent.indexOf('>');
  if (svgOpenEnd === -1) return svgContent;
  const svgOpen = svgContent.slice(0, svgOpenEnd);

  const wMatch = svgOpen.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i);
  const hMatch = svgOpen.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i);

  if (wMatch && hMatch) {
    return svgContent.replace(
      /(<svg\b)/i,
      `$1 viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`,
    );
  }

  return svgContent;
}
