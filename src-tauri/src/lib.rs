use std::{
    fs::{self, OpenOptions},
    io::{Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, UNIX_EPOCH},
};
use futures_util::{SinkExt, StreamExt};
use local_ip_address::local_ip;
use serde::Serialize;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tokio::{net::TcpListener, sync::mpsc};
use tokio_tungstenite::{accept_async, tungstenite::Message};


  /*$$$$$
 /$$__  $$
| $$  \ $$  /$$$$$$   /$$$$$$
| $$$$$$$$ /$$__  $$ /$$__  $$
| $$__  $$| $$  \ $$| $$  \ $$
| $$  | $$| $$  | $$| $$  | $$
| $$  | $$| $$$$$$$/| $$$$$$$/
|__/  |__/| $$____/ | $$____/
          | $$      | $$
          | $$      | $$
          |__/      |_*/

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
        .invoke_handler(tauri::generate_handler![list_folder_items, write_file_at_offset, set_last_modified, server_start, server_send_text, server_send_binary])
        .manage(Arc::new(ServerState::new()))
        //App
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



  /*$$$$$  /$$$$$$$  /$$$$$$
 /$$__  $$| $$__  $$|_  $$_/
| $$  \ $$| $$  \ $$  | $$
| $$$$$$$$| $$$$$$$/  | $$
| $$__  $$| $$____/   | $$
| $$  | $$| $$        | $$
| $$  | $$| $$       /$$$$$$
|__/  |__/|__/      |_____*/

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileItem {
    name: String,
    last_modified: u64,
}

#[tauri::command]
fn list_folder_items(folder_path: String, allow_videos: bool) -> Result<Vec<FileItem>, String> {
    //Get dir
    let dir = Path::new(&folder_path);

    //List entries
    let mut entries: Vec<FileItem> = fs::read_dir(dir)
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
            let name = entry.file_name().to_string_lossy().into_owned();
            let last_modified = entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            FileItem { name, last_modified }
        })
        .collect();

    //Sort newest first
    entries.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    //Return entries
    Ok(entries)
}

#[tauri::command]
fn write_file_at_offset(path: String, offset: u64, data: Vec<u8>) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .open(PathBuf::from(path))
        .map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    file.write_all(&data)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_last_modified(path: String, last_modified: u64) -> Result<(), String> {
    let file = fs::File::open(PathBuf::from(path)).map_err(|e| e.to_string())?;
    let time = UNIX_EPOCH + Duration::from_millis(last_modified);
    file.set_modified(time).map_err(|e| e.to_string())?;
    Ok(())
}



  /*$$$$$
 /$$__  $$
| $$  \__/  /$$$$$$   /$$$$$$  /$$    /$$ /$$$$$$   /$$$$$$
|  $$$$$$  /$$__  $$ /$$__  $$|  $$  /$$//$$__  $$ /$$__  $$
 \____  $$| $$$$$$$$| $$  \__/ \  $$/$$/| $$$$$$$$| $$  \__/
 /$$  \ $$| $$_____/| $$        \  $$$/ | $$_____/| $$
|  $$$$$$/|  $$$$$$$| $$         \  $/  |  $$$$$$$| $$
 \______/  \_______/|__/          \_/    \_______/|_*/

//Connection state
#[derive(Clone, Serialize)]
struct ConnectionStatePayload {
    connected: bool,
    ip: String,
}

//Message
enum SenderMessage {
    Text(String),
    Binary(Vec<u8>),
}

//Server state
struct ServerState {
    sender: tokio::sync::Mutex<Option<mpsc::UnboundedSender<SenderMessage>>>,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            sender: tokio::sync::Mutex::new(None),
        }
    }
}

//Actions
#[tauri::command]
async fn server_start(app: AppHandle, state: State<'_, Arc<ServerState>>, port: u16) -> Result<String, String> {
    //Create address
    let server_address = format!("{}:{}", "0.0.0.0", port);

    //Listen to address
    let listener = TcpListener::bind(&server_address).await.map_err(|e| e.to_string())?;

    //Copy state
    let state_clone = Arc::clone(&state);

    //Run in the background
    tokio::spawn(async move {
        //Mark as running
        let _ = app.emit("ws://server-state", true);

        //Listen for messages
        while let Ok((stream, address)) = listener.accept().await {
            //Get connection ip address
            let client_ip = address.ip().to_string();

            //Check if already connected
            let mut sender_lock = state_clone.sender.lock().await;
            if sender_lock.is_some() {
                //Only allow one connection
                let _ = app.emit("ws://error", format!("Connection from {} refused, only 1 connection is allowed", client_ip));
                continue;
            }

            //Accept connection
            let ws_stream = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(e) => {
                    let _ = app.emit("ws://error", e.to_string());
                    continue;
                }
            };

            //Set up dual-directional messaging channels
            let (mut ws_sender, mut ws_receiver) = ws_stream.split();
            let (sender, mut receiver) = mpsc::unbounded_channel::<SenderMessage>();
            *sender_lock = Some(sender);
            drop(sender_lock);

            //Mark as connected
            let _ = app.emit("ws://connection-state", ConnectionStatePayload { connected: true, ip: client_ip.clone() });

            //Run in the background
            tokio::spawn(async move {
                while let Some(msg) = receiver.recv().await {
                    let result = match msg {
                        SenderMessage::Text(t) => ws_sender.send(Message::Text(t.into())).await,
                        SenderMessage::Binary(b) => ws_sender.send(Message::Binary(b.into())).await,
                    };
                    if result.is_err() {
                        break;
                    }
                }
            });

            //Process messages
            while let Some(msg) = ws_receiver.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        let _ = app.emit("ws://message-string", text.to_string());
                    }
                    Ok(Message::Binary(bin)) => {
                        let _ = app.emit("ws://message-binary", bin.to_vec());
                    }
                    Ok(Message::Close(_)) | Err(_) => break,
                    _ => {}
                }
            }

            //Clear connection
            let mut sender_lock = state_clone.sender.lock().await;
            *sender_lock = None;

            //Mark as not connected
            let _ = app.emit("ws://connection-state", ConnectionStatePayload { connected: false, ip: client_ip });
        }

        //Mark as not running
        let _ = app.emit("ws://server-state", false);
    });

    //Get local IP
    let local_ip = local_ip().map_err(|e| e.to_string())?.to_string();

    //Finish
    Ok(local_ip)
}

#[tauri::command]
async fn server_send_text(state: State<'_, Arc<ServerState>>, message: String) -> Result<(), String> {
    //Send text message
    let sender_lock = state.sender.lock().await;
    if let Some(sender) = sender_lock.as_ref() {
        sender.send(SenderMessage::Text(message)).map_err(|e| e.to_string())?;
    }

    //Finish
    Ok(())
}

#[tauri::command]
async fn server_send_binary(state: State<'_, Arc<ServerState>>, data: Vec<u8>) -> Result<(), String> {
    //Send binary message
    let sender_lock = state.sender.lock().await;
    if let Some(sender) = sender_lock.as_ref() {
        sender.send(SenderMessage::Binary(data)).map_err(|e| e.to_string())?;
    }

    //Finish
    Ok(())
}
