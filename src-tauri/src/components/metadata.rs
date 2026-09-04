use std::{
    process::{Command, Stdio, Child},
    io::{BufReader, BufRead, Write},
    sync::Arc,
};
use serde_json::json;
use tauri::{State, Manager};
use tokio::sync::Mutex;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;



 /*$      /$$             /$$                     /$$             /$$
| $$$    /$$$            | $$                    | $$            | $$
| $$$$  /$$$$  /$$$$$$  /$$$$$$    /$$$$$$   /$$$$$$$  /$$$$$$  /$$$$$$    /$$$$$$
| $$ $$/$$ $$ /$$__  $$|_  $$_/   |____  $$ /$$__  $$ |____  $$|_  $$_/   |____  $$
| $$  $$$| $$| $$$$$$$$  | $$      /$$$$$$$| $$  | $$  /$$$$$$$  | $$      /$$$$$$$
| $$\  $ | $$| $$_____/  | $$ /$$ /$$__  $$| $$  | $$ /$$__  $$  | $$ /$$ /$$__  $$
| $$ \/  | $$|  $$$$$$$  |  $$$$/|  $$$$$$$|  $$$$$$$|  $$$$$$$  |  $$$$/|  $$$$$$$
|__/     |__/ \_______/   \___/   \_______/ \_______/ \_______/   \___/   \______*/

//Worker
pub struct MetadataWorker {
    process: Child,
}

impl MetadataWorker {
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self, String> {
        //Resolve path to python server
        let script_path = if cfg!(debug_assertions) {
            //Testing -> Project root
            std::path::PathBuf::from("../src-python/metadata_server.py")
        } else {
            //Production -> Resolve bundled resource
            app_handle
                .path()
                .resolve("python/metadata_server.py", tauri::path::BaseDirectory::Resource)
                .map_err(|e| e.to_string())?
        };

        //Resolve path to python excutable
        let python_path = if cfg!(debug_assertions) {
            //Testing -> Project root
            std::path::PathBuf::from("../src-python/.venv/Scripts/python.exe")
        } else {
            //Production -> Resolve bundled resource
            app_handle
                .path()
                .resolve("python/.venv/Scripts/python.exe", tauri::path::BaseDirectory::Resource)
                .map_err(|e| e.to_string())?
        };

        //Prepare python command
        let mut cmd = Command::new(if python_path.exists() {
            strip_unc_prefix(&python_path)
        } else {
            "python".to_string()
        });
        cmd.arg("-u")
           .arg(strip_unc_prefix(&script_path))
           .stdin(Stdio::piped())
           .stdout(Stdio::piped())
           .stderr(Stdio::inherit());

        //Hide console window on Windows
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);

        //Run python process
        let mut process = cmd.spawn().map_err(|e| e.to_string())?;

        //Wait for model to finish loading
        let stdout = process.stdout.as_mut().ok_or_else(|| "Failed to capture stdout".to_string())?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;

        Ok(Self { process })
    }

    pub fn kill(&mut self) -> Result<(), String> {
        self.process.kill().map_err(|e| e.to_string())
    }

    fn send(&mut self, payload: serde_json::Value) -> Result<serde_json::Value, String>{
        let stdin = self.process.stdin.as_mut().ok_or_else(|| "Failed to access stdin".to_string())?;
        let stdout = self.process.stdout.as_mut().ok_or_else(|| "Failed to access stdout".to_string())?;
        let mut reader = BufReader::new(stdout);

        //Prepare request
        let req = payload.to_string();

        //Send request to Python process
        writeln!(stdin, "{}", req).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;

        //Read result
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;
        let res: serde_json::Value = serde_json::from_str(&line).map_err(|e| e.to_string())?;

        if res["status"] == "ok" {
            Ok(res)
        } else {
            Err(res["message"].as_str().unwrap_or("Unknown error").to_string())
        }
    }

    //Description
    pub fn load_description(&mut self) -> Result<(), String> {
        //Load model
        self.send(json!({
            "command": "load_description_model"
        }))?;

        //Finish
        Ok(())
    }

    pub fn unload_description(&mut self) -> Result<(), String> {
        //Unload model
        self.send(json!({
            "command": "unload_description_model"
        }))?;

        //Finish
        Ok(())
    }

    pub fn process_image(&mut self, image_path: &str, caption: &bool, labels: &bool, text: &bool) -> Result<String, String> {
        //Unload model
        let res = self.send(json!({
            "command": "process_image",
            "image_path": image_path,
            "caption": caption,
            "labels": labels,
            "text": text
        }))?;

        //Finish
        Ok(res["result"].to_string())
    }

    //Embeddings
    pub fn load_embeddings(&mut self) -> Result<(), String> {
        //Load model
        self.send(json!({
            "command": "load_embeddings_model"
        }))?;

        //Finish
        Ok(())
    }

    pub fn unload_embeddings(&mut self) -> Result<(), String> {
        //Unload model
        self.send(json!({
            "command": "unload_embeddings_model"
        }))?;

        //Finish
        Ok(())
    }

    pub fn generate_embedding(&mut self, text: &str) -> Result<String, String> {
        //Unload model
        let res = self.send(json!({
            "command": "generate_embedding",
            "text": text
        }))?;

        //Finish
        Ok(res["result"].to_string())
    }
}

//State
pub struct MetadataState {
    pub worker: Mutex<Option<MetadataWorker>>
}

impl MetadataState {
    pub fn new() -> Self {
        Self {
            worker: Mutex::new(None)
        }
    }

    pub async fn get_worker_mut(&self, app_handle: &tauri::AppHandle) -> Result<tokio::sync::MutexGuard<'_, Option<MetadataWorker>>, String> {
        let mut guard = self.worker.lock().await;
        if guard.is_none() {
            *guard = Some(MetadataWorker::new(app_handle)?);
        }
        Ok(guard)
    }
}

//Commands
#[tauri::command]
pub async fn load_description_model(app_handle: tauri::AppHandle, state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut guard = state.get_worker_mut(&app_handle).await?;
    let worker = guard.as_mut().unwrap();

    //Load model
    worker.load_description().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unload_description_model(app_handle: tauri::AppHandle, state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut guard = state.get_worker_mut(&app_handle).await?;
    let worker = guard.as_mut().unwrap();

    //Unload model
    worker.unload_description().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn process_image(app_handle: tauri::AppHandle, state: State<'_, Arc<MetadataState>>, image_path: String, caption: bool, labels: bool, text: bool) -> Result<String, String> {
    //Get worker
    let mut guard = state.get_worker_mut(&app_handle).await?;
    let worker = guard.as_mut().unwrap();

    //Process image
    worker.process_image(&image_path, &caption, &labels, &text).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_embeddings_model(app_handle: tauri::AppHandle, state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut guard = state.get_worker_mut(&app_handle).await?;
    let worker = guard.as_mut().unwrap();

    //Load model
    worker.load_embeddings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unload_embeddings_model(app_handle: tauri::AppHandle, state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut guard = state.get_worker_mut(&app_handle).await?;
    let worker = guard.as_mut().unwrap();

    //Unload model
    worker.unload_embeddings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_embedding(app_handle: tauri::AppHandle, state: State<'_, Arc<MetadataState>>, text: String) -> Result<String, String> {
    //Get worker
    let mut guard = state.get_worker_mut(&app_handle).await?;
    let worker = guard.as_mut().unwrap();

    //Process image
    worker.generate_embedding(&text).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn shutdown_metadata_server(app_handle: tauri::AppHandle, state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut guard = state.get_worker_mut(&app_handle).await?;
    if let Some(mut worker) = guard.take() {
        //Kill python process
        let _ = worker.kill();
    }

    //Finish
    Ok(())
}

//Util
fn strip_unc_prefix(path: &std::path::Path) -> String {
    path.to_string_lossy()
        .trim_start_matches(r"\\?\")
        .to_string()
}
