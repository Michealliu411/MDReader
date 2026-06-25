use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub file_path: String,
    pub heading_id: String,
    pub heading_text: String,
}

fn bookmarks_file_path(dir: &Path) -> PathBuf {
    dir.join("bookmarks.json")
}

pub fn load(dir: &Path) -> Vec<Bookmark> {
    match fs::read_to_string(bookmarks_file_path(dir)) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// 返回某文件的所有书签(前端目前自己 filter,此函数供测试和未来命令使用)
#[allow(dead_code)]
pub fn list_for_file(dir: &Path, file_path: &str) -> Vec<Bookmark> {
    load(dir)
        .into_iter()
        .filter(|b| b.file_path == file_path)
        .collect()
}

/// 添加书签(去重:同文件同标题只存一个)
pub fn add(dir: &Path, bookmark: Bookmark) -> Result<Vec<Bookmark>, String> {
    let mut list = load(dir);
    let exists = list
        .iter()
        .any(|b| b.file_path == bookmark.file_path && b.heading_id == bookmark.heading_id);
    if !exists {
        list.push(bookmark);
        let json = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        fs::write(bookmarks_file_path(dir), json).map_err(|e| e.to_string())?;
    }
    Ok(list)
}

/// 删除书签
pub fn remove(
    dir: &Path,
    file_path: &str,
    heading_id: &str,
) -> Result<Vec<Bookmark>, String> {
    let mut list = load(dir);
    list.retain(|b| !(b.file_path == file_path && b.heading_id == heading_id));
    let json = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    fs::write(bookmarks_file_path(dir), json).map_err(|e| e.to_string())?;
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir() -> PathBuf {
        let mut d = env::temp_dir();
        d.push(format!(
            "mdreader-bm-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn load_empty_returns_empty() {
        let dir = temp_dir();
        assert!(load(&dir).is_empty());
    }

    #[test]
    fn add_then_load() {
        let dir = temp_dir();
        add(
            &dir,
            Bookmark {
                file_path: "/a.md".into(),
                heading_id: "h1".into(),
                heading_text: "H1".into(),
            },
        )
        .unwrap();
        let list = load(&dir);
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn add_dedupes_same_file_and_heading() {
        let dir = temp_dir();
        let bm = Bookmark {
            file_path: "/a.md".into(),
            heading_id: "h1".into(),
            heading_text: "H1".into(),
        };
        add(&dir, bm.clone()).unwrap();
        add(&dir, bm).unwrap();
        assert_eq!(load(&dir).len(), 1);
    }

    #[test]
    fn remove_works() {
        let dir = temp_dir();
        add(
            &dir,
            Bookmark {
                file_path: "/a.md".into(),
                heading_id: "h1".into(),
                heading_text: "H1".into(),
            },
        )
        .unwrap();
        remove(&dir, "/a.md", "h1").unwrap();
        assert!(load(&dir).is_empty());
    }

    #[test]
    fn list_for_file_filters() {
        let dir = temp_dir();
        add(
            &dir,
            Bookmark {
                file_path: "/a.md".into(),
                heading_id: "h1".into(),
                heading_text: "H1".into(),
            },
        )
        .unwrap();
        add(
            &dir,
            Bookmark {
                file_path: "/b.md".into(),
                heading_id: "h2".into(),
                heading_text: "H2".into(),
            },
        )
        .unwrap();
        assert_eq!(list_for_file(&dir, "/a.md").len(), 1);
    }
}
