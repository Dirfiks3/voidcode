use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// The running `opencode-cli.exe` sidecar. Killing it on close guarantees no orphan server is left behind.
pub struct SidecarState(pub Mutex<Option<CommandChild>>);

pub struct SpawnedSidecar {
    pub url: String,
}

pub fn spawn(app: &AppHandle) -> Result<SpawnedSidecar, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);

    let (mut events, child) = app
        .shell()
        .sidecar("opencode-cli")?
        .args(["serve", "--hostname", "127.0.0.1", "--port", &port.to_string()])
        .envs([("OPENCODE_PASSWORD", "voidcode")])
        .set_process_group(true)
        .spawn()?;

    app.manage(SidecarState(Mutex::new(Some(child))));

    // Drain the sidecar's output so it never blocks on a full pipe.
    tauri::async_runtime::spawn(async move {
        while events.recv().await.is_some() {}
    });

    Ok(SpawnedSidecar {
        url: format!("http://127.0.0.1:{}", port),
    })
}

pub fn wait_healthy(url: &str, timeout: Duration) -> bool {
    let started = std::time::Instant::now();
    while started.elapsed() < timeout {
        if healthy(url) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    healthy(url)
}

fn healthy(base: &str) -> bool {
    // This repository ships the v2 CLI (/api/info); older sidecars answer /global/health.
    probe(base, "/api/info") || probe(base, "/global/health")
}

fn probe(base: &str, path: &str) -> bool {
    let addr = base.trim_start_matches("http://");
    let Ok(mut stream) = TcpStream::connect_timeout(
        &addr.parse().unwrap_or_else(|_| "127.0.0.1:0".parse().unwrap()),
        Duration::from_millis(250),
    ) else {
        return false
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
    let request = format!("GET {} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n", path);
    if stream.write_all(request.as_bytes()).is_err() {
        return false
    }
    let mut reply = [0u8; 256];
    match stream.read(&mut reply) {
        Ok(len) => String::from_utf8_lossy(&reply[..len]).contains("200"),
        Err(_) => false,
    }
}

pub fn stop(app: &AppHandle) {
    let Some(state) = app.try_state::<SidecarState>() else {
        return
    };
    let Ok(mut guard) = state.0.lock() else {
        return
    };
    let Some(child) = guard.take() else {
        return
    };

    let pid = child.pid();

    // Job-object kill on Windows covers the full tree; keep plain kill as fallback.
    let _ = child.kill();

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }
}
