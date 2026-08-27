use std::{
    fs::{self, OpenOptions},
    io::{Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    time::{Duration, UNIX_EPOCH},
};
use serde::{Serialize};



 /*$$$$$$$ /$$ /$$
| $$_____/|__/| $$
| $$       /$$| $$  /$$$$$$   /$$$$$$$
| $$$$$   | $$| $$ /$$__  $$ /$$_____/
| $$__/   | $$| $$| $$$$$$$$|  $$$$$$
| $$      | $$| $$| $$_____/ \____  $$
| $$      | $$| $$|  $$$$$$$ /$$$$$$$/
|__/      |__/|__/ \_______/|______*/

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub last_modified: u64,
    pub is_video: bool,
}

#[tauri::command]
pub fn list_folder_items(folder_path: String, ignore_videos: bool) -> Result<Vec<FileItem>, String> {
    let dir = Path::new(&folder_path);

    let mut entries: Vec<FileItem> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|res| res.ok())
        .filter_map(|entry| {
            let path = entry.path();
            let is_file = entry.file_type().map(|ft| ft.is_file()).unwrap_or(false);
            if !is_file {
                return None;
            }

            let ext = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.to_lowercase());

            let is_image = matches!(
                ext.as_deref(),
                Some("png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif" | "heic" | "heif" | "avif" | "tiff")
            );
            let is_video = matches!(
                ext.as_deref(),
                Some("mp4" | "mkv" | "webm" | "mov" | "avi" | "wmv" | "flv" | "m4v")
            );

            if !is_image && (ignore_videos || !is_video) {
                return None;
            }

            let name = entry.file_name().to_string_lossy().into_owned();
            let path_str = path.to_string_lossy().into_owned();
            let last_modified = entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            Some(FileItem { name, path: path_str, last_modified, is_video })
        })
        .collect();

    entries.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(entries)
}

#[tauri::command]
pub fn write_file_at_offset(path: String, offset: u64, data: Vec<u8>) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(PathBuf::from(path))
        .map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    file.write_all(&data)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_last_modified(path: String, last_modified: u64) -> Result<(), String> {
    let file = fs::OpenOptions::new()
        .write(true)
        .open(PathBuf::from(path))
        .map_err(|e| e.to_string())?;
    let time = UNIX_EPOCH + Duration::from_millis(last_modified);
    file.set_modified(time).map_err(|e| e.to_string())?;
    Ok(())
}
