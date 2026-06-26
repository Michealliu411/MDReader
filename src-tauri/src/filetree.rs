use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<TreeNode>,
}

const MD_EXTS: &[&str] = &["md", "markdown"];
const MAX_DEPTH: u8 = 10;

fn is_markdown(name: &str) -> bool {
    MD_EXTS
        .iter()
        .any(|ext| name.to_lowercase().ends_with(ext))
}

/// 递归遍历目录,构建树。只含 .md 文件 + 子目录(跳过空目录和隐藏文件)。
pub fn build_tree(dir: &Path, depth: u8) -> TreeNode {
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let path = dir.to_string_lossy().to_string();

    let mut node = TreeNode {
        name,
        path,
        is_dir: true,
        children: vec![],
    };

    if depth >= MAX_DEPTH {
        return node;
    }

    if let Ok(entries) = fs::read_dir(dir) {
        let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        entries.sort_by_key(|e| e.file_name());

        for entry in entries {
            let entry_path = entry.path();
            let entry_name = entry.file_name().to_string_lossy().to_string();

            // 跳过隐藏文件/目录(以 . 开头)
            if entry_name.starts_with('.') {
                continue;
            }

            if entry_path.is_dir() {
                let child = build_tree(&entry_path, depth + 1);
                // 只添加非空目录(有子内容的)
                if !child.children.is_empty() {
                    node.children.push(child);
                }
            } else if is_markdown(&entry_name) {
                node.children.push(TreeNode {
                    name: entry_name,
                    path: entry_path.to_string_lossy().to_string(),
                    is_dir: false,
                    children: vec![],
                });
            }
        }
    }
    node
}

fn workspace_file_path(dir: &Path) -> PathBuf {
    dir.join("workspace.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEntry {
    pub path: String,
}

pub fn load_workspace(dir: &Path) -> Option<String> {
    fs::read_to_string(workspace_file_path(dir))
        .ok()
        .and_then(|c| serde_json::from_str::<WorkspaceEntry>(&c).ok())
        .map(|w| w.path)
}

pub fn save_workspace(dir: &Path, path: &str) -> Result<(), String> {
    let entry = WorkspaceEntry {
        path: path.to_string(),
    };
    let json = serde_json::to_string_pretty(&entry).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    fs::write(workspace_file_path(dir), json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let mut d = std::env::temp_dir();
        d.push(format!(
            "mdreader-tree-test-{}-{}",
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
    fn build_tree_empty_dir() {
        let dir = temp_dir();
        let tree = build_tree(&dir, 0);
        assert!(tree.children.is_empty());
    }

    #[test]
    fn build_tree_with_md_files() {
        let dir = temp_dir();
        fs::write(dir.join("a.md"), "# A").unwrap();
        fs::write(dir.join("b.md"), "# B").unwrap();
        fs::write(dir.join("readme.txt"), "not md").unwrap();
        let tree = build_tree(&dir, 0);
        // 所有子项都是 md 文件(不含 txt),且 a.md b.md 都在
        assert!(tree.children.iter().all(|c| !c.is_dir));
        assert!(tree.children.iter().any(|c| c.name == "a.md"));
        assert!(tree.children.iter().any(|c| c.name == "b.md"));
        assert!(tree.children.iter().all(|c| is_markdown(&c.name)));
    }

    #[test]
    fn build_tree_skips_hidden() {
        let dir = temp_dir();
        fs::write(dir.join(".hidden.md"), "# hidden").unwrap();
        fs::write(dir.join("visible.md"), "# visible").unwrap();
        let tree = build_tree(&dir, 0);
        // 隐藏文件被跳过,visible.md 在
        assert!(tree.children.iter().all(|c| !c.name.starts_with('.')));
        assert!(tree.children.iter().any(|c| c.name == "visible.md"));
    }

    #[test]
    fn build_tree_with_subdirs() {
        let dir = temp_dir();
        fs::create_dir_all(dir.join("sub")).unwrap();
        fs::write(dir.join("sub").join("c.md"), "# C").unwrap();
        let tree = build_tree(&dir, 0);
        // 至少有 sub 目录,且 sub 里有 c.md
        let sub = tree.children.iter().find(|c| c.is_dir && c.name == "sub");
        assert!(sub.is_some(), "sub 目录应存在");
        assert!(sub.unwrap().children.iter().any(|c| c.name == "c.md"));
    }

    #[test]
    fn build_tree_skips_empty_subdirs() {
        let dir = temp_dir();
        fs::create_dir_all(dir.join("empty")).unwrap();
        fs::write(dir.join("a.md"), "# A").unwrap();
        let tree = build_tree(&dir, 0);
        // empty 目录被跳过(无 md 内容)
        assert!(tree.children.iter().all(|c| c.name != "empty"));
    }

    #[test]
    fn workspace_roundtrip() {
        let dir = temp_dir();
        save_workspace(&dir, "/some/path").unwrap();
        assert_eq!(load_workspace(&dir), Some("/some/path".to_string()));
    }

    #[test]
    fn workspace_missing_returns_none() {
        let dir = temp_dir();
        assert!(load_workspace(&dir).is_none());
    }
}
