use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc;
use tauri::{AppHandle, Emitter, Manager};

/// 全局状态:持有当前文件监听器。换文件时先停旧的再启新的。
pub struct WatcherState {
    pub watcher: Option<RecommendedWatcher>,
}

/// 开始监听指定路径。若已有 watcher 则先停止。
#[tauri::command]
pub fn start_watching(app: AppHandle, path: String) -> Result<(), String> {
    // 停止旧 watcher
    {
        let state = app.state::<std::sync::Mutex<WatcherState>>();
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard.watcher = None;
    }

    let (tx, rx) = mpsc::channel();
    let mut watcher =
        notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    let watch_path = path.clone();
    watcher
        .watch(
            std::path::Path::new(&watch_path),
            RecursiveMode::NonRecursive,
        )
        .map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    std::thread::spawn(move || {
        for res in rx {
            if let Ok(event) = res {
                if matches!(
                    event.kind,
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
                ) {
                    let _ = app_handle.emit("file-changed", &watch_path);
                }
            }
        }
    });

    let state = app.state::<std::sync::Mutex<WatcherState>>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.watcher = Some(watcher);
    Ok(())
}

/// 停止监听。
#[tauri::command]
pub fn stop_watching(app: AppHandle) -> Result<(), String> {
    let state = app.state::<std::sync::Mutex<WatcherState>>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.watcher = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn watcher_state_starts_none() {
        let state = WatcherState { watcher: None };
        assert!(state.watcher.is_none());
    }
}
