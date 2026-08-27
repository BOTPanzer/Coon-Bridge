use std::sync::Arc;
use futures_util::{SinkExt, StreamExt};
use local_ip_address::local_ip;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::{net::TcpListener, sync::mpsc};
use tokio_tungstenite::{accept_async, tungstenite::Message};



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
pub struct ServerState {
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
pub async fn server_start(app: AppHandle, state: State<'_, Arc<ServerState>>, port: u16) -> Result<String, String> {
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
pub async fn server_send_text(state: State<'_, Arc<ServerState>>, message: String) -> Result<(), String> {
    //Send text message
    let sender_lock = state.sender.lock().await;
    if let Some(sender) = sender_lock.as_ref() {
        sender.send(SenderMessage::Text(message)).map_err(|e| e.to_string())?;
    }

    //Finish
    Ok(())
}

#[tauri::command]
pub async fn server_send_binary(state: State<'_, Arc<ServerState>>, data: Vec<u8>) -> Result<(), String> {
    //Send binary message
    let sender_lock = state.sender.lock().await;
    if let Some(sender) = sender_lock.as_ref() {
        sender.send(SenderMessage::Binary(data)).map_err(|e| e.to_string())?;
    }

    //Finish
    Ok(())
}
