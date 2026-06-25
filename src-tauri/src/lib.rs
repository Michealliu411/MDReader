// MD Reader - Tauri 后端入口
mod progress;

use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager};

/// 读取本地文件内容。失败返回中文错误信息,前端展示给用户。
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    if !Path::new(&path).exists() {
        return Err(format!("文件不存在: {}", path));
    }
    let bytes = fs::read(&path).map_err(|e| format!("读取失败: {}", e))?;
    // UTF-8 检测:非 UTF-8 文件提示用户转换编码
    match String::from_utf8(bytes) {
        Ok(content) => Ok(content),
        Err(_) => Err("文件编码不支持,请转为 UTF-8".to_string()),
    }
}

/// 保存某文件的阅读进度(上次读到的标题)。写失败静默返回错误,前端 catch 后忽略。
#[tauri::command]
fn save_progress(
    app: AppHandle,
    path: String,
    heading_id: String,
) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let timestamp = chrono::Utc::now().timestamp();
    progress::set(&data_dir, &path, heading_id, timestamp)
}

/// 读取某文件的阅读进度。无记录或文件损坏时返回 None。
#[tauri::command]
fn load_progress(
    app: AppHandle,
    path: String,
) -> Result<Option<progress::ProgressEntry>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let map = progress::load(&data_dir);
    Ok(progress::get(&map, &path))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            save_progress,
            load_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
