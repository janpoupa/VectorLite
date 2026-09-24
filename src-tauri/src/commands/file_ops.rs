use base64::Engine;
use base64::prelude::BASE64_STANDARD;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Supported vector/document file extensions for folder navigation.
const SUPPORTED_EXTS: &[&str] = &["svg", "pdf"];

/// Payload returned when a file is successfully loaded.
#[derive(Debug, Serialize, Deserialize)]
pub struct FilePayload {
    /// For SVG: raw SVG xml text.
    /// For PDF: "data:application/pdf;base64,..."
    pub content: String,
    /// Absolute path of the loaded file
    pub path: String,
    /// Filename only (e.g. "logo.svg")
    pub name: String,
    /// Lowercase extension without dot (e.g. "svg")
    pub extension: String,
    /// View mode: "svg" or "pdf"
    pub view_type: String,
}

/// Returns the initial file path passed via CLI argument.
#[tauri::command]
pub fn get_initial_file(state: tauri::State<'_, crate::AppState>) -> Option<String> {
    state.initial_file.lock().unwrap().clone()
}

/// Native file open dialog using rfd.
#[tauri::command]
pub fn pick_file_dialog() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter("Vector & Document Files", &["svg", "pdf"])
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}

/// Native file save dialog using rfd.
#[tauri::command]
pub fn pick_save_dialog(default_name: String, format: String) -> Option<String> {
    rfd::FileDialog::new()
        .set_file_name(&default_name)
        .add_filter("Image", &[&format])
        .save_file()
        .map(|p| p.to_string_lossy().to_string())
}

/// Saves raw base64 data to an output path (used for PDF image export).
#[tauri::command]
pub fn save_binary_file(output_path: String, base64_data: String) -> Result<(), String> {
    let clean = base64_data.split(',').nth(1).unwrap_or(&base64_data);
    let bytes = BASE64_STANDARD.decode(clean).map_err(|e| format!("Base64 decode error: {}", e))?;
    std::fs::write(&output_path, &bytes).map_err(|e| format!("Failed to write to '{}': {}", output_path, e))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Main file operations
// ---------------------------------------------------------------------------

/// Reads and loads vector/document files (SVG, PDF) for instant viewing.
#[tauri::command]
pub fn load_file(path: String) -> Result<FilePayload, String> {
    let p = Path::new(&path);

    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !p.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    let extension = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let name = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    match extension.as_str() {
        "svg" => {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read SVG '{}': {}", path, e))?;
            Ok(FilePayload {
                content,
                path,
                name,
                extension,
                view_type: "svg".to_string(),
            })
        }
        "pdf" => {
            let bytes = std::fs::read(&path)
                .map_err(|e| format!("Failed to read PDF '{}': {}", path, e))?;
            let content = format!("data:application/pdf;base64,{}", BASE64_STANDARD.encode(&bytes));
            Ok(FilePayload {
                content,
                path,
                name,
                extension,
                view_type: "pdf".to_string(),
            })
        }
        other => Err(format!("Unsupported format: .{}", other)),
    }
}

/// Lists all supported vector files in the same directory as `path`, sorted
/// alphabetically (case-insensitive).
#[tauri::command]
pub fn list_siblings(path: String) -> Result<Vec<String>, String> {
    let p = Path::new(&path);
    let parent = p.parent().ok_or("File has no parent directory")?;

    let mut siblings: Vec<String> = std::fs::read_dir(parent)
        .map_err(|e| format!("Cannot read directory: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let ep = entry.path();
            if !ep.is_file() {
                return false;
            }
            let ext = ep
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            SUPPORTED_EXTS.contains(&ext.as_str())
        })
        .map(|entry| entry.path().to_string_lossy().to_string())
        .collect();

    siblings.sort_by(|a, b| {
        let fa = Path::new(a)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_lowercase();
        let fb = Path::new(b)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_lowercase();
        fa.cmp(&fb)
    });

    Ok(siblings)
}
