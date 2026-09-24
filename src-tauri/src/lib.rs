use std::sync::Mutex;

pub mod commands;

/// Global application state shared across all Tauri commands.
pub struct AppState {
    /// The file path passed as a CLI argument (e.g. when the user double-clicks
    /// an SVG in Explorer with VectorLite set as the default handler).
    pub initial_file: Mutex<Option<String>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Capture the initial file argument before Tauri takes over the process.
    // Filter out Tauri's own internal flags (they start with "--").
    let initial_file: Option<String> = std::env::args()
        .nth(1)
        .filter(|arg| !arg.starts_with("--"));

    tauri::Builder::default()
        .manage(AppState {
            initial_file: Mutex::new(initial_file),
        })
        .invoke_handler(tauri::generate_handler![
            commands::file_ops::get_initial_file,
            commands::file_ops::load_file,
            commands::file_ops::list_siblings,
            commands::file_ops::pick_file_dialog,
            commands::file_ops::pick_save_dialog,
            commands::file_ops::save_binary_file,
            commands::export::export_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
