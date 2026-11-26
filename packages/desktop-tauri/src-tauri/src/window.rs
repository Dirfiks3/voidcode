use tauri::{Manager, WebviewWindow};

/// Apply the default Liquid Glass material to the frameless main window.
pub fn setup_window(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        // Deep charcoal AMOLED substrate under the renderer's glass layers.
        // Slightly translucent so the OS blur reads as dark glass, not flat grey.
        let _ = window_vibrancy::apply_acrylic(window, Some((5, 5, 8, 210)));
    }

    #[cfg(not(windows))]
    let _ = window;

    Ok(())
}

/// Back-compat for app-level setup.
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        setup_window(&window)?;
    }
    Ok(())
}
