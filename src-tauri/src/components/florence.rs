use std::{
    process::{Command, Stdio, Child},
    io::{BufReader, BufRead, Write},
    sync::Arc,
};
use serde_json::json;
use anyhow::{Ok, Result, anyhow};
use tauri::{State};
use tokio::sync::Mutex;



 /*$      /$$                 /$$           /$$
| $$$    /$$$                | $$          | $$
| $$$$  /$$$$  /$$$$$$   /$$$$$$$  /$$$$$$ | $$
| $$ $$/$$ $$ /$$__  $$ /$$__  $$ /$$__  $$| $$
| $$  $$$| $$| $$  \ $$| $$  | $$| $$$$$$$$| $$
| $$\  $ | $$| $$  | $$| $$  | $$| $$_____/| $$
| $$ \/  | $$|  $$$$$$/|  $$$$$$$|  $$$$$$$| $$
|__/     |__/ \______/  \_______/ \_______/|_*/

//Model
pub struct Florence2Worker {
    process: Child,
}

impl Florence2Worker {
    pub fn new() -> Result<Self> {
        //Run python process
        let mut process = Command::new("python")
            .arg("../src-python/florence_server.py")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;

        //Wait for model to finish loading
        let stdout = process.stdout.as_mut().ok_or_else(|| anyhow!("Failed to capture stdout"))?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader.read_line(&mut line)?;

        Ok(Self { process })
    }

    fn send(&mut self, payload: serde_json::Value) -> Result<serde_json::Value>{
        let stdin = self.process.stdin.as_mut().ok_or_else(|| anyhow!("Failed to access stdin"))?;
        let stdout = self.process.stdout.as_mut().ok_or_else(|| anyhow!("Failed to access stdout"))?;
        let mut reader = BufReader::new(stdout);

        //Prepare request
        let req = payload.to_string();

        //Send request to Python process
        writeln!(stdin, "{}", req)?;
        stdin.flush()?;

        //Read result
        let mut line = String::new();
        reader.read_line(&mut line)?;
        let res: serde_json::Value = serde_json::from_str(&line)?;

        if res["status"] == "ok" {
            Ok(res)
        } else {
            Err(anyhow!(res["message"].as_str().unwrap_or("Unknown error").to_string()))
        }
    }

    pub fn load(&mut self) -> Result<()> {
        //Load model
        self.send(json!({
            "command": "load"
        }))?;

        //Finish
        Ok(())
    }

    pub fn unload(&mut self) -> Result<()> {
        //Unload model
        self.send(json!({
            "command": "unload"
        }))?;

        //Finish
        Ok(())
    }

    pub fn process(&mut self, image_path: &str, caption: &bool, labels: &bool, text: &bool) -> Result<String> {
        //Unload model
        let res = self.send(json!({
            "image_path": image_path,
            "command": "process",
            "caption": caption,
            "labels": labels,
            "text": text
        }))?;

        //Finish
        Ok(res["result"].to_string())
    }
}

//State
pub struct Florence2State {
    pub worker: Mutex<Florence2Worker>,
}

impl Florence2State {
    pub fn new() -> Self {
        Self {
            worker: Mutex::new(Florence2Worker::new().expect("Failed to start Florence2 worker")),
        }
    }
}

//Commands
#[tauri::command]
pub async fn load_model(state: State<'_, Arc<Florence2State>>) -> Result<(), String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Load model
    worker.load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unload_model(state: State<'_, Arc<Florence2State>>) -> Result<(), String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Unload model
    worker.unload().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn process_image(state: State<'_, Arc<Florence2State>>, image_path: String, caption: bool, labels: bool, text: bool) -> Result<String, String> {
    //Get worker
    let mut worker = state.worker.lock().await;

    //Process image
    worker.process(&image_path, &caption, &labels, &text).map_err(|e| e.to_string())
}
