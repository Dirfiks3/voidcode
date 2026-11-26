use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter};

type Session = (
    Box<dyn portable_pty::MasterPty + Send>,
    Box<dyn Write + Send>,
    Box<dyn portable_pty::Child + Send>,
);

#[derive(Default)]
pub struct PtyState {
    sessions: Mutex<HashMap<String, Session>>,
}

#[tauri::command]
pub fn pty_spawn(app: AppHandle, state: tauri::State<'_, PtyState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let pty = NativePtySystem::default()
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;

    let shell = std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".into());
    let command = CommandBuilder::new(&shell);
    let child = pty.slave.spawn_command(command).map_err(|error| error.to_string())?;
    let mut reader = pty.master.try_clone_reader().map_err(|error| error.to_string())?;
    let writer = pty.master.take_writer().map_err(|error| error.to_string())?;

    state
        .sessions
        .lock()
        .map_err(|_| "pty state is unavailable".to_string())?
        .insert(id.clone(), (pty.master, writer, child));

    let event_id = id.clone();
    std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(len) => {
                    let data = String::from_utf8_lossy(&buffer[..len]).into_owned();
                    let _ = app.emit("voidcode://pty-data", (event_id.clone(), data));
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(state: tauri::State<'_, PtyState>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|_| "pty state is unavailable".to_string())?;
    let session = sessions.get_mut(&id).ok_or_else(|| "unknown pty session".to_string())?;
    session.1.write_all(data.as_bytes()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn pty_resize(state: tauri::State<'_, PtyState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|_| "pty state is unavailable".to_string())?;
    let session = sessions.get_mut(&id).ok_or_else(|| "unknown pty session".to_string())?;
    session
        .0
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn pty_kill(state: tauri::State<'_, PtyState>, id: String) {
    if let Ok(mut sessions) = state.sessions.lock() {
        if let Some(mut session) = sessions.remove(&id) {
            let _ = session.2.kill();
        }
    }
}
