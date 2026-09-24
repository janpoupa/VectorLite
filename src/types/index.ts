// ─── Background modes ────────────────────────────────────────────────────────

export type BackgroundMode = 'checkerboard' | 'white' | 'black';

// ─── Rust command payloads ───────────────────────────────────────────────────

/** Returned by the `load_file` Rust command */
export interface FilePayload {
  content: string;
  path: string;
  name: string;
  extension: string;
  view_type: 'svg' | 'pdf';
}

/** Options passed to the `export_image` Rust command */
export interface ExportOptions {
  svg_content: string;
  format: 'png' | 'jpg' | 'webp';
  width: number;
  output_path: string;
  background_color: string | null;
}

// ─── Frontend state types ────────────────────────────────────────────────────

export interface PanState {
  x: number;
  y: number;
}
