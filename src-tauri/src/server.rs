use std::sync::{
    Arc, 
    atomic::{AtomicBool, Ordering}
};
use futures_util::{SinkExt, StreamExt};
use local_ip_address::local_ip;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::{
    net::TcpListener, 
    sync::{
        Mutex, 
        mpsc::{UnboundedSender, unbounded_channel}
    }
};
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
pub struct ConnectionStatePayload {
    connected: bool,
    ip: String,
}

//Message
pub enum SenderMessage {
    Text(String),
    Binary(Vec<u8>),
}

//Server state
pub struct ServerState {
    pub sender: Mutex<Option<UnboundedSender<SenderMessage>>>,
    pub is_starting: AtomicBool,
    pub is_running: AtomicBool,
    pub is_connected: AtomicBool,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            sender: Mutex::new(None),
            is_starting: AtomicBool::new(false),
            is_running: AtomicBool::new(false),
            is_connected: AtomicBool::new(false),
        }
    }

    pub fn emit_log(app: &AppHandle, message: impl Into<String>) {
        let _ = app.emit("ws://log", message.into());
    }
}

//Actions
#[tauri::command]
pub async fn server_start(app: AppHandle, state: State<'_, Arc<ServerState>>, port: u16) -> Result<String, String> {
    //Check if already running
    if state.is_running.load(Ordering::SeqCst) {
        return Err("Server is already running".into());
    }

    //Check if already starting
    if state.is_starting.load(Ordering::SeqCst) {
        return Err("Server is already starting".into());
    }

    //Mark as starting
    state.is_starting.store(true, Ordering::SeqCst);

    //Create address & listen to it
    let server_address = format!("0.0.0.0:{}", port);
    let listener = match TcpListener::bind(&server_address).await {
        Ok(lis) => lis,
        Err(e) => {
            //Mark as not starting
            state.is_starting.store(false, Ordering::SeqCst);

            //Throw error
            return Err(format!("Internal error: {}", e));
        }
    };

    //Get local IP
    let local_ip = match local_ip() {
        Ok(ip) => ip.to_string(),
        Err(e) => {
            //Mark as not starting
            state.is_starting.store(false, Ordering::SeqCst);

            //Throw error
            return Err(format!("Failed to get local IP: {}", e));
        }
    };

    //Clone info to use in the server thread
    let thread_state = Arc::clone(&state);
    let thread_app = app.clone();

    //Run server thread
    tokio::spawn(async move {
        //Mark as running
        thread_state.is_starting.store(false, Ordering::SeqCst);
        thread_state.is_running.store(true, Ordering::SeqCst);
        let _ = thread_app.emit("ws://server-state", true);

        //Listen for messages
        while let Ok((stream, address)) = listener.accept().await {
            //Get connection ip address
            let client_ip: String = address.ip().to_string();

            //Check if already connected
            let mut sender_lock = thread_state.sender.lock().await;
            if sender_lock.is_some() {
                //Only allow one connection
                let _ = thread_app.emit("ws://error", format!("Connection from {} refused, only 1 connection is allowed", client_ip));
                continue;
            }

            //Accept connection
            let ws_stream = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(e) => {
                    //Failed to accept client
                    let _ = thread_app.emit("ws://error", e.to_string());
                    continue;
                }
            };

            //Set up dual-directional messaging channels
            let (mut ws_sender, mut ws_receiver) = ws_stream.split();
            let (sender, mut receiver) = unbounded_channel::<SenderMessage>();
            *sender_lock = Some(sender);
            drop(sender_lock);

            //Mark as connected
            thread_state.is_connected.store(true, Ordering::SeqCst);
            let _ = thread_app.emit("ws://connection-state", ConnectionStatePayload { connected: true, ip: client_ip.clone() });

            //Run in the background
            let app_writer = thread_app.clone();
            tokio::spawn(async move {
                while let Some(msg) = receiver.recv().await {
                    let result = match msg {
                        SenderMessage::Text(t) => ws_sender.send(Message::Text(t.into())).await,
                        SenderMessage::Binary(b) => ws_sender.send(Message::Binary(b.into())).await,
                    };
                    if result.is_err() {
                        ServerState::emit_log(&app_writer, "Failed to send WebSocket message");
                        break;
                    }
                }
            });

            //Process messages
            while let Some(msg) = ws_receiver.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        let _ = thread_app.emit("ws://message-string", text.to_string());
                    }
                    Ok(Message::Binary(bin)) => {
                        let _ = thread_app.emit("ws://message-binary", bin.to_vec());
                    }
                    Ok(Message::Close(_)) | Err(_) => break,
                    _ => {}
                }
            }

            //Clear connection
            let mut sender_lock = thread_state.sender.lock().await;
            *sender_lock = None;

            //Mark as not connected
            thread_state.is_connected.store(false, Ordering::SeqCst);
            let _ = thread_app.emit("ws://connection-state", ConnectionStatePayload { connected: false, ip: client_ip.clone() });
        }

        //Mark as not running
        thread_state.is_running.store(false, Ordering::SeqCst);
        let _ = thread_app.emit("ws://server-state", false);
    });

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
