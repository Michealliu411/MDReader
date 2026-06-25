use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEntry {
    pub heading_id: String,
    pub updated_at: i64,
}

pub type ProgressMap = HashMap<String, ProgressEntry>;

fn progress_file_path(dir: &Path) -> PathBuf {
    dir.join("progress.json")
}

pub fn load(dir: &Path) -> ProgressMap {
    let path = progress_file_path(dir);
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => ProgressMap::new(),
    }
}

pub fn get(map: &ProgressMap, file_path: &str) -> Option<ProgressEntry> {
    map.get(file_path).cloned()
}

pub fn set(
    dir: &Path,
    file_path: &str,
    heading_id: String,
    timestamp: i64,
) -> Result<(), String> {
    let mut map = load(dir);
    map.insert(
        file_path.to_string(),
        ProgressEntry {
            heading_id,
            updated_at: timestamp,
        },
    );
    let json = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    fs::write(progress_file_path(dir), json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir() -> PathBuf {
        let mut d = env::temp_dir();
        d.push(format!(
            "mdreader-test-{}-{}",
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
    fn load_empty_dir_returns_empty_map() {
        let dir = temp_dir();
        let map = load(&dir);
        assert!(map.is_empty());
    }

    #[test]
    fn set_then_load_roundtrip() {
        let dir = temp_dir();
        set(&dir, "/a/spec.md", "概述".to_string(), 1000).unwrap();
        let map = load(&dir);
        let entry = map.get("/a/spec.md").unwrap();
        assert_eq!(entry.heading_id, "概述");
        assert_eq!(entry.updated_at, 1000);
    }

    #[test]
    fn get_missing_returns_none() {
        let map = ProgressMap::new();
        assert!(get(&map, "/none.md").is_none());
    }

    #[test]
    fn set_overwrites_existing() {
        let dir = temp_dir();
        set(&dir, "/a.md", "旧标题".to_string(), 1).unwrap();
        set(&dir, "/a.md", "新标题".to_string(), 2).unwrap();
        let map = load(&dir);
        let entry = map.get("/a.md").unwrap();
        assert_eq!(entry.heading_id, "新标题");
        assert_eq!(entry.updated_at, 2);
    }

    #[test]
    fn corrupted_json_returns_empty() {
        let dir = temp_dir();
        fs::write(progress_file_path(&dir), "{bad json").unwrap();
        let map = load(&dir);
        assert!(map.is_empty());
    }
}
