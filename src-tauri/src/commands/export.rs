use resvg::{
    tiny_skia::{Color, Pixmap, Transform},
    usvg,
};
use serde::{Deserialize, Serialize};

/// Options passed from the frontend for image export.
#[derive(Debug, Deserialize, Serialize)]
pub struct ExportOptions {
    /// SVG XML string (with any color modifications already applied)
    pub svg_content: String,
    /// Output format: "png", "jpg", or "webp"
    pub format: String,
    /// Target width in pixels; height is calculated to preserve aspect ratio
    pub width: u32,
    /// Absolute path where the exported file should be written
    pub output_path: String,
    /// Optional background color as a 6-digit hex string (e.g. "#ffffff").
    /// `None` means transparent (only meaningful for PNG).
    pub background_color: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn hex_to_color(hex: &str) -> Option<Color> {
    let h = hex.trim_start_matches('#');
    if h.len() < 6 {
        return None;
    }
    let r = u8::from_str_radix(&h[0..2], 16).ok()? as f32 / 255.0;
    let g = u8::from_str_radix(&h[2..4], 16).ok()? as f32 / 255.0;
    let b = u8::from_str_radix(&h[4..6], 16).ok()? as f32 / 255.0;
    Color::from_rgba(r, g, b, 1.0)
}

/// Composite RGBA pixels onto an opaque white background, returning RGB bytes.
/// Used when exporting to formats that don't support transparency (JPEG).
fn flatten_rgba_on_white(rgba: &[u8], width: u32, height: u32) -> Vec<u8> {
    let pixel_count = (width * height) as usize;
    let mut rgb = Vec::with_capacity(pixel_count * 3);
    for i in 0..pixel_count {
        let base = i * 4;
        let a = rgba[base + 3] as f32 / 255.0;
        let r = (rgba[base] as f32 * a + 255.0 * (1.0 - a)).round() as u8;
        let g = (rgba[base + 1] as f32 * a + 255.0 * (1.0 - a)).round() as u8;
        let b = (rgba[base + 2] as f32 * a + 255.0 * (1.0 - a)).round() as u8;
        rgb.push(r);
        rgb.push(g);
        rgb.push(b);
    }
    rgb
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

/// Rasterizes an SVG string using `resvg` and saves the result as PNG, JPEG,
/// or WebP. The output width is set to `options.width`; height is computed to
/// preserve the SVG's aspect ratio.
#[tauri::command]
pub fn export_image(options: ExportOptions) -> Result<(), String> {
    // --- Parse SVG ---
    let opt = usvg::Options::default();
    let tree = usvg::Tree::from_str(&options.svg_content, &opt)
        .map_err(|e| format!("SVG parse error: {}", e))?;

    // --- Calculate target dimensions ---
    let svg_size = tree.size();
    if svg_size.width() == 0.0 || svg_size.height() == 0.0 {
        return Err("SVG has zero size".to_string());
    }

    let scale = options.width as f32 / svg_size.width();
    let height = (svg_size.height() * scale).ceil() as u32;

    if options.width == 0 || height == 0 {
        return Err("Computed export size is zero".to_string());
    }

    // --- Allocate pixel buffer ---
    let mut pixmap = Pixmap::new(options.width, height)
        .ok_or("Failed to allocate pixel buffer (out of memory?)")?;

    // --- Apply background ---
    let needs_opaque = options.format == "jpg" || options.format == "jpeg";
    match &options.background_color {
        Some(hex) if !hex.is_empty() => {
            if let Some(color) = hex_to_color(hex) {
                pixmap.fill(color);
            } else if needs_opaque {
                pixmap.fill(Color::from_rgba8(255, 255, 255, 255));
            }
        }
        _ => {
            if needs_opaque {
                // JPEG cannot encode transparency; default to white
                pixmap.fill(Color::from_rgba8(255, 255, 255, 255));
            }
            // PNG: leave transparent (all zeroes = transparent black)
        }
    }

    // --- Render SVG ---
    resvg::render(
        &tree,
        Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );

    // --- Encode and write ---
    match options.format.as_str() {
        "png" => {
            pixmap
                .save_png(&options.output_path)
                .map_err(|e| format!("PNG write error: {}", e))?;
        }

        "jpg" | "jpeg" => {
            let rgb_bytes = flatten_rgba_on_white(pixmap.data(), options.width, height);
            let img = image::RgbImage::from_raw(options.width, height, rgb_bytes)
                .ok_or("Failed to construct RGB image buffer")?;
            img.save_with_format(&options.output_path, image::ImageFormat::Jpeg)
                .map_err(|e| format!("JPEG write error: {}", e))?;
        }

        "webp" => {
            let rgba_data = pixmap.data().to_vec();
            let img = image::RgbaImage::from_raw(options.width, height, rgba_data)
                .ok_or("Failed to construct RGBA image buffer")?;
            image::DynamicImage::ImageRgba8(img)
                .save_with_format(&options.output_path, image::ImageFormat::WebP)
                .map_err(|e| format!("WebP write error: {}", e))?;
        }

        other => {
            return Err(format!("Unsupported export format: '{}'", other));
        }
    }

    Ok(())
}
