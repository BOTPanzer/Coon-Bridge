use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};
use std::fs;
use std::path::Path;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        //Plugins
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        //Single instance
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        //Tray
        .setup(|app| {
            let show_item = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let exit_item = MenuItemBuilder::with_id("exit", "Exit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &exit_item])
                .build()?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Coon Bridge")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "exit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        //Custom API
        .invoke_handler(tauri::generate_handler![list_folder_items])
        //App
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

//Custom API
#[tauri::command]
fn list_folder_items(folder_path: String, allow_videos: bool) -> Result<Vec<String>, String> {
    //Get dir
    let dir = Path::new(&folder_path);

    //List entries
    let mut entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|res| res.ok())
        .filter(|entry| {
            let path = entry.path();
            let is_file = entry.file_type().map(|ft| ft.is_file()).unwrap_or(false);
            let ext = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.to_lowercase());
            let is_image = matches!(
                ext.as_deref(),
                Some("png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif" | "heic" | "heif" | "avif" | "tiff")
            );
            let is_video = allow_videos && matches!(
                ext.as_deref(),
                Some("mp4" | "mkv" | "webm" | "mov" | "avi" | "wmv" | "flv" | "m4v")
            );
            is_file && (is_image || is_video)
        })
        .map(|entry| {
            let mtime = entry.metadata()
                .and_then(|m| m.modified())
                .ok();
            (entry.file_name().to_string_lossy().into_owned(), mtime)
        })
        .collect();

    //Sort newest first
    entries.sort_by(|a, b| b.1.cmp(&a.1));

    //Return entries
    Ok(entries.into_iter().map(|(name, _)| name).collect())
}
