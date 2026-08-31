use std::{
    process::{Command, Stdio, Child},
    io::{BufReader, BufRead, Write},
    sync::Arc,
};
use serde_json::json;
use tauri::{State};
use tokio::sync::Mutex;



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
    pub fn new() -> Result<Self, String> {
        //Run python process
        let mut process = Command::new("python")
            .arg("../src-python/metadata_server.py")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| e.to_string())?;

        //Wait for model to finish loading
        let stdout = process.stdout.as_mut().ok_or_else(|| "Failed to capture stdout".to_string())?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;

        Ok(Self { process })
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
            "command": "load_description"
        }))?;

        //Finish
        Ok(())
    }

    pub fn unload_description(&mut self) -> Result<(), String> {
        //Unload model
        self.send(json!({
            "command": "unload_description"
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
            "command": "load_embeddings"
        }))?;

        //Finish
        Ok(())
    }

    pub fn unload_embeddings(&mut self) -> Result<(), String> {
        //Unload model
        self.send(json!({
            "command": "unload_embeddings"
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
    pub worker: Mutex<MetadataWorker>,
}

impl MetadataState {
    pub fn new() -> Self {
        Self {
            worker: Mutex::new(MetadataWorker::new().expect("Failed to start metadata worker")),
        }
    }
}

//Commands
#[tauri::command]
pub async fn load_description_model(state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Load model
    worker.load_description().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unload_description_model(state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Unload model
    worker.unload_description().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn process_image(state: State<'_, Arc<MetadataState>>, image_path: String, caption: bool, labels: bool, text: bool) -> Result<String, String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Process image
    worker.process_image(&image_path, &caption, &labels, &text).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_embeddings_model(state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Load model
    worker.load_embeddings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unload_embeddings_model(state: State<'_, Arc<MetadataState>>) -> Result<(), String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Unload model
    worker.unload_embeddings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_embedding(state: State<'_, Arc<MetadataState>>, text: String) -> Result<String, String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Process image
    worker.generate_embedding(&text).map_err(|e| e.to_string())
}
