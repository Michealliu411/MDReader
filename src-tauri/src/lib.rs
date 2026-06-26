// MD Reader - Tauri 后端入口
mod bookmarks;
mod fetcher;
mod filetree;
mod progress;
mod recent;
mod watcher;

use std::fs;
use std::path::Path;
use std::sync::Mutex;
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

/// 加载最近打开列表。
#[tauri::command]
fn load_recent(app: AppHandle) -> Result<Vec<recent::RecentEntry>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(recent::load(&data_dir))
}

/// 添加到最近打开(去重/移到最前/截断)。
#[tauri::command]
fn add_recent(
    app: AppHandle,
    path: String,
    name: String,
) -> Result<Vec<recent::RecentEntry>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let timestamp = chrono::Utc::now().timestamp();
    recent::add(&data_dir, path, name, timestamp)
}

/// 加载所有书签。
#[tauri::command]
fn load_bookmarks(app: AppHandle) -> Result<Vec<bookmarks::Bookmark>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(bookmarks::load(&data_dir))
}

/// 添加书签(去重)。
#[tauri::command]
fn add_bookmark(
    app: AppHandle,
    file_path: String,
    heading_id: String,
    heading_text: String,
) -> Result<Vec<bookmarks::Bookmark>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    bookmarks::add(
        &data_dir,
        bookmarks::Bookmark {
            file_path,
            heading_id,
            heading_text,
        },
    )
}

/// 删除书签。
#[tauri::command]
fn remove_bookmark(
    app: AppHandle,
    file_path: String,
    heading_id: String,
) -> Result<Vec<bookmarks::Bookmark>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    bookmarks::remove(&data_dir, &file_path, &heading_id)
}

/// 写文本文件(导出用)。
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("写入失败: {}", e))
}

/// 遍历目录构建文件树(只含 .md + 子目录)。
#[tauri::command]
fn list_dir(path: String) -> Result<filetree::TreeNode, String> {
    Ok(filetree::build_tree(std::path::Path::new(&path), 0))
}

/// 加载上次打开的文件夹路径。
#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Option<String>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(filetree::load_workspace(&data_dir))
}

/// 保存当前打开的文件夹路径。
#[tauri::command]
fn save_workspace(app: AppHandle, path: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    filetree::save_workspace(&data_dir, &path)
}

/// 拉取网络 md(先缓存秒开,后台刷新由前端二次调用 fetch_url_fresh 触发)。
#[tauri::command]
fn fetch_url(app: AppHandle, url: String) -> Result<fetcher::FetchResult, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fetcher::fetch(&url, &data_dir)
}

/// 强制重新拉取(忽略缓存)。
#[tauri::command]
fn fetch_url_fresh(app: AppHandle, url: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fetcher::fetch_fresh(&url, &data_dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(watcher::WatcherState { watcher: None }))
        .invoke_handler(tauri::generate_handler![
            read_file,
            save_progress,
            load_progress,
            load_recent,
            add_recent,
            load_bookmarks,
            add_bookmark,
            remove_bookmark,
            write_text_file,
            list_dir,
            load_workspace,
            save_workspace,
            fetch_url,
            fetch_url_fresh,
            watcher::start_watching,
            watcher::stop_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
