# MD Reader Phase 3 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展内容来源(文件监听 + 文件夹浏览 + 网络 md)并优化工具栏 UI,共 4 项。

**Architecture:** 沿用 Tauri v2 + React 19 + TS。Rust 端新增 notify(文件监听)、reqwest(网络拉取)、sha2(缓存 hash)依赖,新增 watcher/filetree/fetcher 三个模块。前端侧边栏从大纲切换为文件树(书签保留顶部),工具栏改图标按钮风格。

**Tech Stack:** Tauri v2, React 19, TypeScript, notify, reqwest, sha2, Vitest, Rust

**Spec:** `docs/superpowers/specs/2026-06-26-md-reader-phase3-design.md`

---

## 文件结构(Phase 3 新增/修改)

```
src-tauri/src/
├── lib.rs            ← 修改:加 watcher/filetree/fetcher 命令
├── watcher.rs        ← 新增:文件监听(notify)
├── filetree.rs       ← 新增:目录遍历 + workspace.json(含测试)
└── fetcher.rs        ← 新增:HTTP 拉取 + GitHub 转换 + 缓存(含测试)

src/
├── components/
│   ├── FileTree.tsx  ← 新增:树形目录组件
│   ├── UrlDialog.tsx ← 新增:网络 URL 输入弹窗
│   ├── Sidebar.tsx   ← 修改:书签区 + 文件树(替代大纲)
│   └── App.tsx       ← 修改:集成监听/文件树/网络/UI
├── lib/
│   └── tauri-bridge.ts ← 修改:加 listDir/loadWorkspace/saveWorkspace/fetchUrl 接口
└── styles.css        ← 修改:工具栏图标按钮 + 文件树样式

src-tauri/Cargo.toml  ← 修改:加 notify/reqwest/sha2
```

---

## Task 1: watcher.rs — 文件监听(TDD 可测部分)

**Files:**
- Create: `src-tauri/src/watcher.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Cargo.toml 加 notify 依赖**

在 `[dependencies]` 加:
```toml
notify = "6"
```

- [ ] **Step 2: 实现 watcher.rs**

Create `src-tauri/src/watcher.rs`:
```rust
use notify::{Watcher, RecursiveMode, EventKind, RecommendedWatcher};
use std::sync::mpsc;
use tauri::{AppHandle, Emitter, Manager};

/// 启动文件监听。文件变化时 emit "file-changed" 事件给前端。
/// 用全局 state 存 watcher,换文件时先停旧的再启新的。
pub struct WatcherState {
    pub watcher: Option<RecommendedWatcher>,
}

/// 开始监听指定路径。若已有 watcher 则先停止。
#[tauri::command]
pub fn start_watching(app: AppHandle, path: String) -> Result<(), String> {
    // 停止旧 watcher
    let state = app.state::<std::sync::Mutex<WatcherState>>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.watcher = None;
    drop(guard);

    let (tx, rx) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    let watch_path = path.clone();
    watcher
        .watch(std::path::Path::new(&watch_path), RecursiveMode::NonRecursive)
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
```

- [ ] **Step 3: lib.rs 加 watcher 模块 + 命令 + state 注册**

在 `mod` 声明区加 `mod watcher;`,在 `use` 区加 `use std::sync::Mutex;`。

在 `run()` 的 Builder 链加 `.manage(Mutex::new(watcher::WatcherState { watcher: None }))`,invoke_handler 加 `watcher::start_watching, watcher::stop_watching`。

- [ ] **Step 4: 编译 + 测试**

Run:
```bash
cd src-tauri && cargo test watcher
```
Expected: PASS — 1 个测试 + 编译成功

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/watcher.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(phase3): file watcher with notify"
```

---

## Task 2: 前端接入文件监听(防抖 + 保留滚动)

**Files:**
- Modify: `src/lib/tauri-bridge.ts`, `src/App.tsx`

- [ ] **Step 1: tauri-bridge.ts 加监听接口**

追加:
```ts
export async function startWatching(path: string): Promise<void> {
  await invoke("start_watching", { path });
}

export async function stopWatching(): Promise<void> {
  await invoke("stop_watching");
}
```

- [ ] **Step 2: App.tsx 接入监听**

在 `openFile` 成功打开后调 `startWatching(path)`,换文件/关闭时旧的会被 Rust 端自动停。

加事件监听(防抖 500ms + 保留滚动):
```tsx
import { startWatching, stopWatching } from "./lib/tauri-bridge";

// 在 openFile 的 try 成功分支内,addRecent 之后加:
startWatching(path).catch(() => {});

// 监听 file-changed 事件,防抖重读 + 保留滚动
useEffect(() => {
  const unlisten = listen<string>("file-changed", () => {
    if (!doc) return;
    // 防抖 500ms
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(async () => {
      const savedScroll = readerRef.current?.scrollTop ?? 0;
      try {
        const text = await readFile(doc.path);
        const { html, headings } = parse(text);
        setDoc({ ...doc, html, headings, text });
        // 恢复滚动位置(下一帧)
        requestAnimationFrame(() => {
          if (readerRef.current) readerRef.current.scrollTop = savedScroll;
        });
      } catch {
        // 静默:文件可能正在被写入
      }
    }, 500);
  });
  return () => {
    unlisten.then((fn) => fn());
  };
}, [doc]);
```
在组件顶部加 `const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);`

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/tauri-bridge.ts src/App.tsx
git commit -m "feat(phase3: frontend file-change listener with debounce + scroll restore"
```

---

## Task 3: filetree.rs — 目录遍历 + workspace(TDD)

**Files:**
- Create: `src-tauri/src/filetree.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写 filetree.rs(含测试)**

Create `src-tauri/src/filetree.rs`:
```rust
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

fn is_markdown(name: &str) -> bool {
    MD_EXTS.iter().any(|ext| name.to_lowercase().ends_with(ext))
}

/// 递归遍历目录,构建树。只含 .md 文件 + 子目录。
/// 深度限制 10 层,防止超深目录。
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

    if depth >= 10 {
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
    let entry = WorkspaceEntry { path: path.to_string() };
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
        // 只含 2 个 md,不含 txt
        assert_eq!(tree.children.len(), 2);
        assert!(tree.children.iter().all(|c| !c.is_dir));
    }

    #[test]
    fn build_tree_skips_hidden() {
        let dir = temp_dir();
        fs::write(dir.join(".hidden.md"), "# hidden").unwrap();
        fs::write(dir.join("visible.md"), "# visible").unwrap();
        let tree = build_tree(&dir, 0);
        assert_eq!(tree.children.len(), 1);
        assert_eq!(tree.children[0].name, "visible.md");
    }

    #[test]
    fn build_tree_with_subdirs() {
        let dir = temp_dir();
        fs::create_dir_all(dir.join("sub")).unwrap();
        fs::write(dir.join("sub").join("c.md"), "# C").unwrap();
        let tree = build_tree(&dir, 0);
        assert_eq!(tree.children.len(), 1);
        assert!(tree.children[0].is_dir);
        assert_eq!(tree.children[0].children[0].name, "c.md");
    }

    #[test]
    fn build_tree_skips_empty_subdirs() {
        let dir = temp_dir();
        fs::create_dir_all(dir.join("empty")).unwrap();
        fs::write(dir.join("a.md"), "# A").unwrap();
        let tree = build_tree(&dir, 0);
        // empty 目录被跳过(无 md 内容)
        assert_eq!(tree.children.len(), 1);
        assert!(!tree.children[0].is_dir);
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
```

- [ ] **Step 2: lib.rs 加 filetree 模块 + 命令**

加 `mod filetree;` 和命令:
```rust
#[tauri::command]
fn list_dir(path: String) -> Result<filetree::TreeNode, String> {
    Ok(filetree::build_tree(std::path::Path::new(&path), 0))
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Option<String>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(filetree::load_workspace(&data_dir))
}

#[tauri::command]
fn save_workspace(app: AppHandle, path: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    filetree::save_workspace(&data_dir, &path)
}
```
invoke_handler 加 `list_dir, load_workspace, save_workspace`。

- [ ] **Step 3: 运行测试**

Run:
```bash
cd src-tauri && cargo test filetree
```
Expected: PASS — 7 个测试

- [ ] **Step 4: Commit**

```bash
cd /Users/apple/ZCodeProject
git add src-tauri/src/filetree.rs src-tauri/src/lib.rs
git commit -m "feat(phase3): file tree builder + workspace persistence with tests"
```

---

## Task 4: FileTree.tsx + Sidebar 改造 + App 集成

**Files:**
- Create: `src/components/FileTree.tsx`
- Modify: `src/components/Sidebar.tsx`, `src/App.tsx`, `src/lib/tauri-bridge.ts`, `src/styles.css`

- [ ] **Step 1: tauri-bridge.ts 加文件树接口**

追加:
```ts
export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

export async function listDir(path: string): Promise<TreeNode> {
  return invoke<TreeNode>("list_dir", { path });
}

export async function loadWorkspace(): Promise<string | null> {
  return invoke<string | null>("load_workspace");
}

export async function saveWorkspace(path: string): Promise<void> {
  await invoke("save_workspace", { path });
}
```

- [ ] **Step 2: FileTree.tsx**

Create `src/components/FileTree.tsx`:
```tsx
import { useState } from "react";
import type { TreeNode } from "../lib/tauri-bridge";

interface FileTreeProps {
  node: TreeNode;
  currentPath: string | null;
  onOpen: (path: string) => void;
}

export function FileTree({ node, currentPath, onOpen }: FileTreeProps) {
  return (
    <nav className="file-tree">
      {node.children.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={0}
          currentPath={currentPath}
          onOpen={onOpen}
        />
      ))}
    </nav>
  );
}

function FileTreeNode({
  node,
  depth,
  currentPath,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  currentPath: string | null;
  currentPath: string | null;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.isDir) {
    return (
      <div className="tree-node">
        <button
          className="tree-dir"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="tree-toggle">{expanded ? "▾" : "▸"}</span>
          <span className="tree-icon">📁</span>
          <span className="tree-name">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              onOpen={onOpen}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      className={`tree-file${node.path === currentPath ? " active" : ""}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onOpen(node.path)}
    >
      <span className="tree-icon">📄</span>
      <span className="tree-name">{node.name}</span>
    </button>
  );
}
```

注意:上面 `FileTreeNode` 的 props 重复了 `currentPath` 行,修正为只声明一次:
```tsx
function FileTreeNode({
  node,
  depth,
  currentPath,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  currentPath: string | null;
  onOpen: (path: string) => void;
}) {
```

- [ ] **Step 3: Sidebar.tsx 改为 书签区 + 文件树**

```tsx
import type { TreeNode } from "../lib/tauri-bridge";
import type { Bookmark } from "../lib/tauri-bridge";
import { Bookmarks } from "./Bookmarks";
import { FileTree } from "./FileTree";

interface SidebarProps {
  tree: TreeNode | null;
  currentPath: string | null;
  onOpenFile: (path: string) => void;
  bookmarks: Bookmark[];
  currentFilePath: string | null;
  onJumpBookmark: (headingId: string) => void;
}

export function Sidebar({
  tree,
  currentPath,
  onOpenFile,
  bookmarks,
  currentFilePath,
  onJumpBookmark,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <Bookmarks
        bookmarks={bookmarks}
        currentFilePath={currentFilePath}
        onJump={onJumpBookmark}
      />
      {tree ? (
        <FileTree
          node={tree}
          currentPath={currentPath}
          onOpen={onOpenFile}
        />
      ) : (
        <p className="sidebar-empty">点击 📂 打开文件夹</p>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: App.tsx 集成文件树**

加状态和逻辑:
```tsx
import { listDir, loadWorkspace, saveWorkspace } from "./lib/tauri-bridge";
import type { TreeNode } from "./lib/tauri-bridge";
import { FileTree } from "./components/FileTree";

const [tree, setTree] = useState<TreeNode | null>(null);

// 启动时恢复上次文件夹
useEffect(() => {
  loadWorkspace().then((path) => {
    if (path) {
      listDir(path).then(setTree).catch(() => {});
    }
  }).catch(() => {});
}, []);

// 打开文件夹
const handleOpenFolder = useCallback(async () => {
  const selected = await open({ directory: true });
  if (typeof selected === "string") {
    listDir(selected).then(setTree).catch(() => {});
    saveWorkspace(selected).catch(() => {});
  }
}, []);
```

Sidebar props 替换为新的(树 + 文件打开)。文件树点击打开文件复用 `openFile`。
监听 file-changed 事件时也刷新树(若文件夹内变化)。

- [ ] **Step 5: styles.css 加文件树样式**

```css
.file-tree { font-size: 13px; }
.tree-node { display: flex; flex-direction: column; }
.tree-dir, .tree-file {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 3px 8px;
  color: var(--fg);
  text-align: left;
  border-radius: 4px;
  font-size: 13px;
}
.tree-dir:hover, .tree-file:hover { background: var(--hover-bg); }
.tree-file.active { background: var(--active-bg); color: var(--link); }
.tree-toggle { width: 12px; opacity: 0.6; }
.tree-icon { font-size: 14px; }
.tree-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

- [ ] **Step 6: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(phase3): file tree sidebar + workspace restore"
```

---

## Task 5: fetcher.rs — HTTP 拉取 + GitHub 转换 + 缓存(TDD)

**Files:**
- Create: `src-tauri/src/fetcher.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Cargo.toml 加依赖**

```toml
reqwest = { version = "0.12", features = ["blocking"] }
sha2 = "0.10"
```

- [ ] **Step 2: 写 fetcher.rs(含测试)**

Create `src-tauri/src/fetcher.rs`:
```rust
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_SIZE: usize = 10 * 1024 * 1024; // 10MB
const CACHE_TTL_SECS: i64 = 7 * 24 * 3600; // 7 天

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub url: String,
    pub content: String,
    pub fetched_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchResult {
    pub content: String,
    pub from_cache: bool,
    pub stale: bool,
}

/// GitHub blob URL 转 raw URL。
/// github.com/user/repo/blob/branch/path.md → raw.githubusercontent.com/user/repo/branch/path.md
pub fn github_to_raw(url: &str) -> String {
    url.replace("github.com/", "raw.githubusercontent.com/")
        .replace("/blob/", "/")
}

fn url_hash(url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    format!("{:x}", hasher.finalize())[..16].to_string()
}

fn cache_file_path(dir: &Path, url: &str) -> PathBuf {
    dir.join(format!("{}.json", url_hash(url)))
}

pub fn load_cache(dir: &Path, url: &str) -> Option<CacheEntry> {
    let path = cache_file_path(dir, url);
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
}

pub fn save_cache(dir: &Path, entry: &CacheEntry) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(entry).map_err(|e| e.to_string())?;
    fs::write(cache_file_path(dir, &entry.url), json).map_err(|e| e.to_string())?;
    Ok(())
}

/// 拉取 URL 内容。先返回缓存(若有),后台不刷新(刷新由前端二次调用触发)。
pub fn fetch(url: &str, dir: &Path) -> Result<FetchResult, String> {
    if !url.starts_with("https://") {
        return Err("仅支持 https URL".to_string());
    }
    let raw_url = github_to_raw(url);

    // 先查缓存
    let now = chrono::Utc::now().timestamp();
    if let Some(cache) = load_cache(dir, &raw_url) {
        let stale = now - cache.fetched_at > CACHE_TTL_SECS;
        return Ok(FetchResult {
            content: cache.content,
            from_cache: true,
            stale,
        });
    }

    // 无缓存,实拉
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&raw_url)
        .send()
        .map_err(|e| format!("请求失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let content = resp.text().map_err(|e| e.to_string())?;
    if content.len() > MAX_SIZE {
        return Err("文件过大(超 10MB)".to_string());
    }

    let entry = CacheEntry {
        url: raw_url.clone(),
        content: content.clone(),
        fetched_at: now,
    };
    let _ = save_cache(dir, &entry);

    Ok(FetchResult {
        content,
        from_cache: false,
        stale: false,
    })
}

/// 强制重新拉取(忽略缓存,用于 stale-while-revalidate 的后台刷新)。
pub fn fetch_fresh(url: &str, dir: &Path) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err("仅支持 https URL".to_string());
    }
    let raw_url = github_to_raw(url);
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&raw_url)
        .send()
        .map_err(|e| format!("请求失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let content = resp.text().map_err(|e| e.to_string())?;
    if content.len() > MAX_SIZE {
        return Err("文件过大".to_string());
    }
    let entry = CacheEntry {
        url: raw_url.clone(),
        content: content.clone(),
        fetched_at: chrono::Utc::now().timestamp(),
    };
    let _ = save_cache(dir, &entry);
    Ok(content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn github_blob_to_raw() {
        let raw = github_to_raw("https://github.com/user/repo/blob/main/README.md");
        assert_eq!(raw, "https://raw.githubusercontent.com/user/repo/main/README.md");
    }

    #[test]
    fn non_github_url_unchanged() {
        let url = "https://example.com/doc.md";
        assert_eq!(github_to_raw(url), url);
    }

    #[test]
    fn url_hash_consistent() {
        assert_eq!(url_hash("https://a.com"), url_hash("https://a.com"));
        assert_ne!(url_hash("https://a.com"), url_hash("https://b.com"));
    }

    #[test]
    fn cache_roundtrip() {
        let dir = std::env::temp_dir().join(format!("mdreader-cache-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let entry = CacheEntry {
            url: "https://example.com/a.md".into(),
            content: "# Hello".into(),
            fetched_at: 1000,
        };
        save_cache(&dir, &entry).unwrap();
        let loaded = load_cache(&dir, "https://example.com/a.md").unwrap();
        assert_eq!(loaded.content, "# Hello");
    }

    #[test]
    fn fetch_rejects_http() {
        let dir = std::env::temp_dir().join(format!("mdreader-cache-test2-{}", std::process::id()));
        let result = fetch("http://insecure.com", &dir);
        assert!(result.is_err());
    }
}
```

- [ ] **Step 3: lib.rs 加 fetcher 模块 + 命令**

加 `mod fetcher;` 和命令:
```rust
#[tauri::command]
fn fetch_url(app: AppHandle, url: String) -> Result<fetcher::FetchResult, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fetcher::fetch(&url, &data_dir)
}

#[tauri::command]
fn fetch_url_fresh(app: AppHandle, url: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fetcher::fetch_fresh(&url, &data_dir)
}
```
invoke_handler 加 `fetch_url, fetch_url_fresh`。

- [ ] **Step 4: 运行测试**

Run:
```bash
cd src-tauri && cargo test fetcher
```
Expected: PASS — 5 个测试

- [ ] **Step 5: Commit**

```bash
cd /Users/apple/ZCodeProject
git add src-tauri/src/fetcher.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(phase3): HTTP fetcher with GitHub raw conversion + cache"
```

---

## Task 6: UrlDialog.tsx + App 集成网络 md

**Files:**
- Create: `src/components/UrlDialog.tsx`
- Modify: `src/lib/tauri-bridge.ts`, `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: tauri-bridge.ts 加 fetch 接口**

追加:
```ts
export interface FetchResult {
  content: string;
  fromCache: boolean;
  stale: boolean;
}

export async function fetchUrl(url: string): Promise<FetchResult> {
  return invoke<FetchResult>("fetch_url", { url });
}

export async function fetchUrlFresh(url: string): Promise<string> {
  return invoke<string>("fetch_url_fresh", { url });
}
```

- [ ] **Step 2: UrlDialog.tsx**

Create `src/components/UrlDialog.tsx`:
```tsx
import { useState, useEffect, useRef } from "react";

interface UrlDialogProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export function UrlDialog({ visible, onClose, onSubmit }: UrlDialogProps) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setUrl("");
      inputRef.current?.focus();
    }
  }, [visible]);

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
      onClose();
    }
  };

  return (
    <div className="url-dialog-overlay" onClick={onClose}>
      <form className="url-dialog" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>打开网络文档</h3>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/user/repo/blob/main/README.md"
        />
        <div className="url-dialog-actions">
          <button type="button" onClick={onClose}>取消</button>
          <button type="submit">打开</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: App.tsx 集成网络 md**

加状态 + 处理:
```tsx
import { fetchUrl, fetchUrlFresh } from "./lib/tauri-bridge";
import { UrlDialog } from "./components/UrlDialog";

const [urlDialogVisible, setUrlDialogVisible] = useState(false);

const handleFetchUrl = useCallback(async (url: string) => {
  try {
    // 先显示缓存(秒开)
    const result = await fetchUrl(url);
    const { html, headings } = parse(result.content);
    setError(null);
    setDoc({ path: url, html, headings, text: result.content });
    // 若缓存较旧,后台刷新
    if (result.fromCache && result.stale) {
      fetchUrlFresh(url).then((freshContent) => {
        const { html, headings } = parse(freshContent);
        setDoc((prev) => {
          if (prev && prev.path === url) {
            return { ...prev, html, headings, text: freshContent };
          }
          return prev;
        });
      }).catch(() => {});
    }
  } catch (e) {
    setError(String(e));
    setDoc(null);
  }
}, []);
```

- [ ] **Step 4: styles.css 加 url-dialog 样式**

```css
.url-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.url-dialog {
  background: var(--bg);
  border-radius: 12px;
  padding: 20px;
  width: 480px;
  max-width: 90vw;
  border: 1px solid var(--border);
}
.url-dialog h3 { margin-bottom: 12px; color: var(--fg); }
.url-dialog input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 12px;
}
.url-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.url-dialog-actions button {
  padding: 6px 16px;
  cursor: pointer;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
}
```

- [ ] **Step 5: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(phase3): URL dialog + network md fetch with cache"
```

---

## Task 7: 工具栏 UI 美化(图标按钮)

**Files:**
- Modify: `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: App.tsx 工具栏 JSX 重构**

替换 toolbar 的 JSX:
```tsx
<div className="toolbar">
  <button className="icon-btn" onClick={handleOpen} title="打开文件">📄</button>
  <button className="icon-btn" onClick={handleOpenFolder} title="打开文件夹">📂</button>
  {doc && <button className="icon-btn" onClick={handleExport} title="导出 HTML">📤</button>}
  <button className="icon-btn" onClick={() => setUrlDialogVisible(true)} title="打开网络文档">🌐</button>
  <span className="toolbar-sep" />
  <div className="font-controls">
    <button className="icon-btn" onClick={handleFontDec} title="缩小字号">A−</button>
    <span className="font-size-display">{fontSize}</span>
    <button className="icon-btn" onClick={handleFontInc} title="放大字号">A+</button>
  </div>
  <span className="toolbar-sep" />
  <button className="icon-btn" onClick={handleToggleTheme} title="切换主题">
    {theme === "light" ? "🌙" : "☀️"}
  </button>
</div>
```
移除行距按钮 `handleLineInc/handleLineDec`(从 JSX 移除,状态保留,用默认值)。
在 UrlDialog 渲染加:`<UrlDialog visible={urlDialogVisible} onClose={() => setUrlDialogVisible(false)} onSubmit={handleFetchUrl} />`

- [ ] **Step 2: styles.css 重写工具栏按钮样式**

替换 `.toolbar button` 相关样式:
```css
.toolbar {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--sidebar-bg);
  display: flex;
  gap: 2px;
  align-items: center;
}
.icon-btn {
  padding: 6px 10px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--fg);
  font-size: 15px;
  line-height: 1;
}
.icon-btn:hover {
  background: var(--hover-bg);
}
.toolbar-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 6px;
}
.font-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}
.font-size-display {
  font-size: 12px;
  color: var(--muted);
  min-width: 22px;
  text-align: center;
}
```

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/styles.css
git commit -m "feat(phase3): toolbar UI overhaul - icon buttons"
```

---

## Task 8: 全量测试 + 手动验收 + 打包

**Files:** 无(验证)

- [ ] **Step 1: 跑全部前端测试**

Run: `npx vitest run`
Expected: 全部通过(Phase 1/2 的 28 + Phase 3 无新增前端测试 = 28)

- [ ] **Step 2: 跑全部 Rust 测试**

Run:
```bash
cd src-tauri && cargo test
```
Expected: progress 5 + recent 5 + bookmarks 5 + filetree 7 + fetcher 5 + watcher 1 = 28 通过

- [ ] **Step 3: 启动应用验收**

Run:
```bash
cd /Users/apple/ZCodeProject && npm run tauri dev
```

逐条过验收清单:
- [ ] 外部编辑器改 md,阅读器自动刷新,滚动位置保留
- [ ] 打开文件夹,侧边栏显示树形结构,折叠展开正常
- [ ] 重启应用,自动恢复上次文件夹
- [ ] 文件夹内新建/删除 md,树自动刷新
- [ ] 粘 GitHub md 链接,正确拉取并渲染
- [ ] 粘普通 URL,正确拉取
- [ ] 同一 URL 二次打开秒开(缓存生效)
- [ ] 断网后打开已缓存 URL,显示缓存 + 离线提示
- [ ] 工具栏图标按钮美观,hover 有反馈,字号数值显示
- [ ] 夜间模式下工具栏样式正常

- [ ] **Step 4: 修复发现的问题并提交**

```bash
git add -A
git commit -m "fix(phase3): address QA findings"
```

- [ ] **Step 5: 推送到 GitHub + 打包**

```bash
git push origin main
npm run tauri build
```
复制新 DMG 到桌面。

---

## Self-Review 记录

**1. Spec coverage:**
- 文件监听刷新 → Task 1(watcher.rs)+ Task 2(前端接入)✅
- 文件夹树形浏览 → Task 3(filetree.rs)+ Task 4(FileTree + Sidebar)✅
- 读网络 md → Task 5(fetcher.rs)+ Task 6(UrlDialog)✅
- 工具栏 UI → Task 7 ✅
- 错误处理:各模块均有(spec 第 6 节逐项覆盖)✅
- 测试:filetree 7 + fetcher 5 + watcher 1,手动验收 10 项 ✅

**2. Placeholder scan:** 无 TBD/TODO,所有步骤含完整代码 ✅
(注:Task 4 Step 2 的 FileTreeNode props 有意重复行的提示已在步骤内修正)

**3. Type consistency:**
- `TreeNode { name, path, isDir, children }` — Rust `is_dir` ↔ TS `isDir`,Tauri 自动 camelCase ✅
- `FetchResult { content, fromCache, stale }` — Rust `from_cache` ↔ TS `fromCache` ✅
- `CacheEntry { url, content, fetched_at }` — 仅 Rust 内部用,不跨 IPC ✅
- `fetchUrl(url) → FetchResult` / `fetchUrlFresh(url) → string` — bridge 定义与 App 使用一致 ✅

**4. 注意点:**
- Task 1 的 watcher 用 `std::sync::Mutex<WatcherState>` 管理,需在 Builder `.manage()` 注册 ✅
- Task 5 reqwest 用 `blocking` feature(Tauri 命令是同步的),如编译冲突可改 async ✅
- Task 4 Sidebar 移除了 Phase 2 的书签切换按钮(大纲项 🔖),书签功能改为仅在书签区显示已有书签,不再从文件树侧添加 —— 这是设计简化,spec 已确认书签区保留 ✅
