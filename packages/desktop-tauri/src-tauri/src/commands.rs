use tauri::{AppHandle, Manager, State};

/// URL of the local sidecar, resolved after startup health check.
pub struct ServerUrl(pub String);

#[tauri::command]
pub fn get_system_username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| whoami::username().unwrap_or_default())
}

#[tauri::command]
pub fn server_url(state: State<'_, ServerUrl>) -> String {
    state.0.clone()
}

#[tauri::command]
pub fn window_minimize(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
pub fn window_maximize(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
pub fn window_close(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

#[tauri::command]
pub fn window_start_drag(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.start_dragging();
    }
}

#[tauri::command]
pub fn window_show(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn window_toggle_devtools(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
}

#[tauri::command]
pub fn set_window_effect(app: AppHandle, effect: String) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("main window is unavailable".into())
    };

    #[cfg(windows)]
    match effect.as_str() {
        "mica" => window_vibrancy::apply_mica(&window, Some(true)).map_err(|e| e.to_string())?,
        "acrylic" => {
            window_vibrancy::apply_acrylic(&window, Some((5, 5, 8, 210))).map_err(|e| e.to_string())?
        }
        _ => {
            let _ = window_vibrancy::clear_mica(&window);
            let _ = window_vibrancy::clear_acrylic(&window);
        }
    }

    #[cfg(not(windows))]
    let _ = effect;

    Ok(())
}
