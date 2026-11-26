#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod pty;
mod sidecar;
mod window;

use commands::ServerUrl;
use tauri::Manager;
use tauri::webview::WebviewWindowBuilder;
use tauri::WebviewUrl;

fn init_script(server_url: &str) -> String {
    let encoded = server_url.replace('\\', "\\\\").replace('"', "\\\"");
    format!(
        r#"(function(){{
  try {{
    var server = "{url}";
    window.__OPENCODE__ = Object.assign(window.__OPENCODE__ || {{}}, {{
      runtime: Object.assign((window.__OPENCODE__ && window.__OPENCODE__.runtime) || {{}}, {{
        platform: "desktop",
        serverUrl: server
      }}),
      serverUrl: server
    }});
    window.__OPENCODE_RUNTIME__ = Object.assign(window.__OPENCODE_RUNTIME__ || {{}}, {{
      platform: "desktop",
      serverUrl: server
    }});

    var params = new URLSearchParams(location.search);
    if (server && location.protocol !== "data:") {{
      var token = btoa("opencode:voidcode").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      var changed = false;
      if (!params.get("auth_token")) {{ params.set("auth_token", token); changed = true; }}
      if (params.get("voidcode_server")) {{ params.delete("voidcode_server"); changed = true; }}
      if (changed) {{
        history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params.toString() : "") + location.hash);
      }}
      try {{
        localStorage.setItem("opencode.global.dat:server", JSON.stringify({{
          list: [{{ type: "http", http: {{ url: server }} }}],
          hidden: {{}}, lastProjectID: {{}}, usedProjectIDs: {{}}, hostnames: {{}}, projects: {{}}
        }}));
      }} catch (_) {{}}
    }}
  }} catch (_) {{}}
}})();"#,
        url = encoded
    )
}


fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(pty::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            commands::get_system_username,
            commands::server_url,
            commands::window_show,
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::window_start_drag,
            commands::set_window_effect,
            commands::window_toggle_devtools,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
        ])
        .setup(|app| {
            let spawned = sidecar::spawn(app.handle())?;
            let server_url = spawned.url.clone();
            app.manage(ServerUrl(server_url.clone()));

            let init = init_script(&server_url);

            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("loading.html".into()))
                .title("VoidCode")
                .inner_size(1440.0, 900.0)
                .min_inner_size(720.0, 520.0)
                .center()
                .decorations(false)
                .transparent(true)
                .resizable(true)
                .visible(false)
                .devtools(true)
                .initialization_script(&init)
                .build()?;

            window::setup_window(&win)?;
            let _ = win.show();

            let app_handle = app.handle().clone();
            let url = server_url.clone();
            std::thread::spawn(move || {
                let _ready = sidecar::wait_healthy(&url, std::time::Duration::from_secs(10));
                if let Some(win) = app_handle.get_webview_window("main") {
                    let _ = win.navigate("http://tauri.localhost/".parse().unwrap());
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                sidecar::stop(window.app_handle())
            }
        })
        .build(tauri::generate_context!())
        .expect("VoidCode failed to start")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                sidecar::stop(&app.clone());
            }
        });
}
