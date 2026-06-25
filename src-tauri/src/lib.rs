// MD Reader - Tauri 后端入口
// 命令(read_file / save_progress / load_progress)在 Task 5/6 中添加

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
