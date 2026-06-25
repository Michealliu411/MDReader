use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentEntry {
    pub path: String,
    pub name: String,
    pub opened_at: i64,
}

const MAX_RECENT: usize = 10;

fn recent_file_path(dir: &Path) -> PathBuf {
    dir.join("recent.json")
}

pub fn load(dir: &Path) -> Vec<RecentEntry> {
    match fs::read_to_string(recent_file_path(dir)) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// 添加/移到最前/去重/截断到 MAX_RECENT
pub fn add(
    dir: &Path,
    path: String,
    name: String,
    timestamp: i64,
) -> Result<Vec<RecentEntry>, String> {
    let mut list = load(dir);
    list.retain(|e| e.path != path);
    list.insert(0, RecentEntry {
        path,
        name,
        opened_at: timestamp,
    });
    list.truncate(MAX_RECENT);
    let json = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    fs::write(recent_file_path(dir), json).map_err(|e| e.to_string())?;
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir() -> PathBuf {
        let mut d = env::temp_dir();
        d.push(format!(
            "mdreader-recent-test-{}-{}",
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
        add(&dir, "/a.md".into(), "a.md".into(), 1).unwrap();
        let list = load(&dir);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].path, "/a.md");
    }

    #[test]
    fn add_moves_to_front_and_dedupes() {
        let dir = temp_dir();
        add(&dir, "/a.md".into(), "a.md".into(), 1).unwrap();
        add(&dir, "/b.md".into(), "b.md".into(), 2).unwrap();
        add(&dir, "/a.md".into(), "a.md".into(), 3).unwrap();
        let list = load(&dir);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].path, "/a.md"); // 移到最前
        assert_eq!(list[1].path, "/b.md");
    }

    #[test]
    fn truncates_to_max() {
        let dir = temp_dir();
        for i in 0..15 {
            add(&dir, format!("/{}.md", i), format!("{}.md", i), i as i64).unwrap();
        }
        let list = load(&dir);
        assert_eq!(list.len(), MAX_RECENT);
        assert_eq!(list[0].path, "/14.md"); // 最新在前
    }

    #[test]
    fn corrupted_json_returns_empty() {
        let dir = temp_dir();
        fs::write(recent_file_path(&dir), "bad").unwrap();
        assert!(load(&dir).is_empty());
    }
}
