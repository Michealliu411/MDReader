# MD Reader Phase 2 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Phase 1 单文档阅读器上,优化阅读体验(主题/排版/交互)并补全功能(最近列表/书签/导出),共 10 项。

**Architecture:** 沿用 Phase 1 的 Tauri + React + TS 架构。新增 CSS 变量驱动的主题系统、outline 路径计算库、recent/bookmarks 两个 Rust 持久化模块、导出工具。opener 插件已预先装好。

**Tech Stack:** Tauri v2, React 19, TypeScript, markdown-it, highlight.js, Vitest, Rust

**Spec:** `docs/superpowers/specs/2026-06-25-md-reader-phase2-design.md`

---

## 文件结构(Phase 2 新增/修改)

```
src/
├── lib/
│   ├── theme.ts          ← 新增:主题管理(系统检测 + localStorage + 切换)
│   ├── outline.ts        ← 新增:标题路径计算(面包屑用)
│   ├── export.ts         ← 新增:导出 HTML
│   ├── tauri-bridge.ts   ← 修改:加 loadRecent/addRecent/loadBookmarks/addBookmark/removeBookmark
│   ├── markdown.ts       ← 修改:highlight.js 主题随 data-theme 切换
│   └── __tests__/
│       ├── theme.test.ts
│       ├── outline.test.ts
│       └── export.test.ts
├── components/
│   ├── Breadcrumb.tsx    ← 新增:目录面包屑
│   ├── RecentList.tsx    ← 新增:最近打开列表
│   ├── Bookmarks.tsx     ← 新增:书签分区
│   ├── Sidebar.tsx       ← 修改:书签标记 + 书签分区
│   ├── Reader.tsx        ← 修改:外链点击代理 + 面包屑位
│   ├── SearchBar.tsx     ← 不变
│   └── App.tsx           ← 修改:集成所有新功能
├── hooks/
│   └── useProgress.ts    ← 不变
└── styles.css            ← 修改:CSS 变量 + 新元素样式 + 主题

src-tauri/src/
├── lib.rs                ← 修改:加 recent/bookmark 命令
├── recent.rs             ← 新增:recent.json 读写(含测试)
└── bookmarks.rs          ← 新增:bookmarks.json 读写(含测试)
```

---

## Task 1: 主题系统 — theme.ts + CSS 变量(TDD)

**Files:**
- Create: `src/lib/theme.ts`, `src/lib/__tests__/theme.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: 写失败测试**

Create `src/lib/__tests__/theme.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getInitialTheme, applyTheme, toggleTheme } from "../theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("无存储偏好时跟随系统(亮色)", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: false,
      media: q,
    }));
    expect(getInitialTheme()).toBe("light");
  });

  it("无存储偏好时跟随系统(暗色)", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("dark"),
      media: q,
    }));
    expect(getInitialTheme()).toBe("dark");
  });

  it("有存储偏好时用存储值", () => {
    localStorage.setItem("md-reader-theme", "dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("applyTheme 设置 data-theme 属性", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("toggleTheme 在 light/dark 间切换", () => {
    expect(toggleTheme("light")).toBe("dark");
    expect(toggleTheme("dark")).toBe("light");
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npx vitest run src/lib/__tests__/theme.test.ts`
Expected: FAIL — `Cannot find module '../theme'`

- [ ] **Step 3: 实现 theme.ts**

Create `src/lib/theme.ts`:
```ts
export type Theme = "light" | "dark";

const STORAGE_KEY = "md-reader-theme";

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // 跟随系统
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function toggleTheme(current: Theme): Theme {
  return current === "light" ? "dark" : "light";
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npx vitest run src/lib/__tests__/theme.test.ts`
Expected: PASS — 5 个测试

- [ ] **Step 5: 改 styles.css 用 CSS 变量**

Replace `src/styles.css` 开头的基础样式,加入主题变量(保留原有结构,改色值引用变量):
```css
:root[data-theme="light"] {
  --bg: #ffffff;
  --fg: #222;
  --code-bg: #f6f8fa;
  --sidebar-bg: #fafafa;
  --border: #e0e0e0;
  --muted: #999;
  --link: #0066cc;
  --active-bg: #d6e9ff;
}
:root[data-theme="dark"] {
  --bg: #1e1e1e;
  --fg: #d4d4d4;
  --code-bg: #2d2d2d;
  --sidebar-bg: #252526;
  --border: #3c3c3c;
  --muted: #808080;
  --link: #4da3ff;
  --active-bg: #2d4a6b;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, "Helvetica Neue", sans-serif;
  background: var(--bg);
  color: var(--fg);
}
```
后续 `.toolbar`、`.sidebar`、`.reader` 等的硬编码颜色全部改为 `var(--xxx)`。

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme.ts src/lib/__tests__/theme.test.ts src/styles.css
git commit -m "feat(phase2): theme system with CSS variables (light/dark)"
```

---

## Task 2: 代码配色随主题切换 + highlight.js 主题 CSS

**Files:**
- Modify: `src/lib/markdown.ts`, `src/main.tsx`, `src/styles.css`
- Create: `src/code-themes.css`

- [ ] **Step 1: 装 highlight.js 主题 CSS 包**

Run: `npm install -D highlight.js/styles`
(注:highlight.js 的样式在 `highlight.js/styles/` 目录,已随主包安装,无需额外包)

- [ ] **Step 2: 创建 code-themes.css(导入两套主题,用 data-theme 选择)**

Create `src/code-themes.css`:
```css
/* 日间代码配色 */
:root[data-theme="light"] .hljs {
  color: #24292e;
  background: var(--code-bg);
}
:root[data-theme="light"] .hljs-comment,
:root[data-theme="light"] .hljs-quote { color: #6a737d; }
:root[data-theme="light"] .hljs-keyword,
:root[data-theme="light"] .hljs-selector-tag { color: #d73a49; }
:root[data-theme="light"] .hljs-string,
:root[data-theme="light"] .hljs-attr { color: #032f62; }
:root[data-theme="light"] .hljs-number { color: #005cc5; }
:root[data-theme="light"] .hljs-title,
:root[data-theme="light"] .hljs-section { color: #6f42c1; }

/* 夜间代码配色(github-dark) */
:root[data-theme="dark"] .hljs {
  color: #c9d1d9;
  background: var(--code-bg);
}
:root[data-theme="dark"] .hljs-comment,
:root[data-theme="dark"] .hljs-quote { color: #8b949e; }
:root[data-theme="dark"] .hljs-keyword,
:root[data-theme="dark"] .hljs-selector-tag { color: #ff7b72; }
:root[data-theme="dark"] .hljs-string,
:root[data-theme="dark"] .hljs-attr { color: #a5d6ff; }
:root[data-theme="dark"] .hljs-number { color: #79c0ff; }
:root[data-theme="dark"] .hljs-title,
:root[data-theme="dark"] .hljs-section { color: #d2a8ff; }
```

- [ ] **Step 3: main.tsx 引入 code-themes.css**

在 `src/main.tsx` 的 import 链中加入:
```tsx
import "./code-themes.css";
```

- [ ] **Step 4: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 5: Commit**

```bash
git add src/code-themes.css src/main.tsx
git commit -m "feat(phase2): code highlighting themes follow light/dark"
```

---

## Task 3: 字号/行距调节 + App 主题/字号集成

**Files:**
- Modify: `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: App.tsx 加主题状态 + 字号行距状态**

在 App 组件顶部加状态(在现有 useState 之前):
```tsx
import { getInitialTheme, applyTheme, toggleTheme, saveTheme } from "./lib/theme";

// 在 App 函数内,doc 等状态之前
const [theme, setTheme] = useState<Theme>(() => {
  const t = getInitialTheme();
  applyTheme(t);
  return t;
});
const [fontSize, setFontSize] = useState(() => {
  return parseInt(localStorage.getItem("md-reader-font-size") || "16", 10);
});
const [lineHeight, setLineHeight] = useState(() => {
  return parseFloat(localStorage.getItem("md-reader-line-height") || "1.7");
});

// 应用 CSS 变量
useEffect(() => {
  document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
  localStorage.setItem("md-reader-font-size", String(fontSize));
}, [fontSize]);

useEffect(() => {
  document.documentElement.style.setProperty("--line-height", String(lineHeight));
  localStorage.setItem("md-reader-line-height", String(lineHeight));
}, [lineHeight]);

const handleToggleTheme = () => {
  const next = toggleTheme(theme);
  applyTheme(next);
  saveTheme(next);
  setTheme(next);
};

const handleFontInc = () => setFontSize((s) => Math.min(24, s + 1));
const handleFontDec = () => setFontSize((s) => Math.max(12, s - 1));
const handleLineInc = () => setLineHeight((l) => Math.min(2.2, +(l + 0.1).toFixed(1)));
const handleLineDec = () => setLineHeight((l) => Math.max(1.4, +(l - 0.1).toFixed(1)));
```

- [ ] **Step 2: 工具栏加按钮**

替换 toolbar 的 JSX:
```tsx
<div className="toolbar">
  <button onClick={handleOpen}>打开</button>
  <span className="toolbar-sep" />
  <button onClick={handleFontDec}>A-</button>
  <button onClick={handleFontInc}>A+</button>
  <button onClick={handleLineDec}>≡-</button>
  <button onClick={handleLineInc}>≡+</button>
  <span className="toolbar-sep" />
  <button onClick={handleToggleTheme}>{theme === "light" ? "🌙" : "☀️"}</button>
</div>
```

- [ ] **Step 3: styles.css 加 toolbar 样式 + 字号变量默认值**

在 `:root[data-theme="light"]` 之前加默认字号变量:
```css
:root {
  --font-size: 16px;
  --line-height: 1.7;
}
```
`.reader` 改用变量(已有,确认):
```css
.reader {
  font-size: var(--font-size);
  line-height: var(--line-height);
}
```
加 toolbar 样式:
```css
.toolbar {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--sidebar-bg);
  display: flex;
  gap: 4px;
  align-items: center;
}
.toolbar button { padding: 4px 10px; cursor: pointer; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px; }
.toolbar-sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
```

- [ ] **Step 4: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误(需在 App.tsx 顶部 import type Theme)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/styles.css
git commit -m "feat(phase2): font-size/line-height controls + theme toggle in toolbar"
```

---

## Task 4: 表格/图片/引用块样式

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: 在 styles.css 的 .reader 区块加元素样式**

在 `.reader ul, .reader ol` 之后追加:
```css
.reader table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
  display: block;
  overflow-x: auto;
}
.reader th,
.reader td {
  border: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
}
.reader th {
  background: var(--sidebar-bg);
  font-weight: 600;
}
.reader img {
  max-width: 100%;
  border-radius: 6px;
  display: block;
  margin: 0.8em auto;
}
.reader blockquote {
  border-left: 3px solid var(--link);
  background: var(--sidebar-bg);
  padding: 8px 16px;
  margin: 0.8em 0;
  font-style: italic;
  color: var(--muted);
}
.reader a {
  color: var(--link);
  text-decoration: none;
}
.reader a:hover { text-decoration: underline; }
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat(phase2): styles for table/image/blockquote/link"
```

---

## Task 5: 外链浏览器打开

**Files:**
- Modify: `src/components/Reader.tsx`

- [ ] **Step 1: Reader 加点击代理**

在 Reader 组件中加 onClick 处理(forwardRef 版本,在 return 的 main 上加 onClick):
```tsx
import { forwardRef } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface ReaderProps {
  html: string;
  error: string | null;
}

export const Reader = forwardRef<HTMLElement, ReaderProps>(
  ({ html, error }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor && anchor.href) {
        e.preventDefault();
        openUrl(anchor.href).catch(() => {
          // 静默失败或可提示,这里简单忽略
        });
      }
    };

    if (error) {
      return (
        <main className="reader" ref={ref}>
          <div className="reader-error">{error}</div>
        </main>
      );
    }
    if (!html) {
      return (
        <main className="reader" ref={ref}>
          <div className="reader-empty">打开一个 Markdown 文件开始阅读</div>
        </main>
      );
    }
    return (
      <main
        className="reader"
        ref={ref}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
);

Reader.displayName = "Reader";
```

- [ ] **Step 2: 装前端 opener 包**

Run: `npm install @tauri-apps/plugin-opener`

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 4: Commit**

```bash
git add src/components/Reader.tsx package.json package-lock.json
git commit -m "feat(phase2): open external links in system browser via opener"
```

---

## Task 6: outline.ts — 标题路径计算(TDD,面包屑用)

**Files:**
- Create: `src/lib/outline.ts`, `src/lib/__tests__/outline.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/lib/__tests__/outline.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildPath, type Heading } from "../outline";

const headings: Heading[] = [
  { id: "设计", level: 1, text: "设计" },
  { id: "数据流", level: 2, text: "数据流" },
  { id: "恢复进度", level: 3, text: "恢复进度" },
  { id: "错误处理", level: 2, text: "错误处理" },
  { id: "测试", level: 3, text: "测试" },
];

describe("buildPath", () => {
  it("返回从根到当前标题的完整路径", () => {
    expect(buildPath(headings, "恢复进度")).toEqual(["设计", "数据流", "恢复进度"]);
  });

  it("H2 标题路径只含 H1 和自身", () => {
    expect(buildPath(headings, "错误处理")).toEqual(["设计", "错误处理"]);
  });

  it("H1 标题路径只含自身", () => {
    expect(buildPath(headings, "设计")).toEqual(["设计"]);
  });

  it("找不到标题返回空数组", () => {
    expect(buildPath(headings, "不存在")).toEqual([]);
  });

  it("无标题时返回空", () => {
    expect(buildPath([], "x")).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npx vitest run src/lib/__tests__/outline.test.ts`
Expected: FAIL — `Cannot find module '../outline'`

- [ ] **Step 3: 实现 outline.ts**

Create `src/lib/outline.ts`:
```ts
import type { Heading } from "./markdown";

/**
 * 根据当前标题 id,算出从根 H1 到它的完整层级路径。
 * 父子关系:某标题的父是它前面最近的 level 更小的标题。
 */
export function buildPath(headings: Heading[], currentId: string): string[] {
  const idx = headings.findIndex((h) => h.id === currentId);
  if (idx === -1) return [];

  const current = headings[idx];
  const path: Heading[] = [current];

  // 向前找父级:level 更小的最近标题
  let targetLevel = current.level - 1;
  for (let i = idx - 1; i >= 0 && targetLevel >= 1; i--) {
    if (headings[i].level === targetLevel) {
      path.unshift(headings[i]);
      targetLevel--;
    }
  }
  return path.map((h) => h.text);
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npx vitest run src/lib/__tests__/outline.test.ts`
Expected: PASS — 5 个测试

- [ ] **Step 5: Commit**

```bash
git add src/lib/outline.ts src/lib/__tests__/outline.test.ts
git commit -m "feat(phase2): outline path calculation for breadcrumb"
```

---

## Task 7: Breadcrumb.tsx + 大纲滚动联动

**Files:**
- Create: `src/components/Breadcrumb.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: 实现 Breadcrumb**

Create `src/components/Breadcrumb.tsx`:
```tsx
interface BreadcrumbProps {
  path: string[];
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  if (path.length === 0) return null;
  return (
    <div className="breadcrumb">
      {path.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="breadcrumb-sep"> › </span>}
          {p}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: App.tsx 加即时 activeId + 面包屑**

在 App 中加状态(复用 activeId,但滚动监听改为即时更新而非只走 useProgress):
```tsx
import { buildPath } from "./lib/outline";
import { Breadcrumb } from "./components/Breadcrumb";

// 在组件内,加即时 activeId(独立于 useProgress 的防抖版本)
const [liveActiveId, setLiveActiveId] = useState<string | null>(null);

// 修改滚动监听 useEffect(替换 Phase 1 的版本):
useEffect(() => {
  if (!doc || !readerRef.current) return;
  const reader = readerRef.current;
  const handler = () => {
    const headings = reader.querySelectorAll("h1, h2, h3, h4");
    let visible: Element | null = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top >= 0) {
        visible = h;
        break;
      }
    }
    if (visible && visible.textContent) {
      setLiveActiveId(visible.textContent);  // 即时,给面包屑和大纲
      recordHeading(visible.textContent);    // 防抖,给进度
    }
  };
  reader.addEventListener("scroll", handler);
  return () => reader.removeEventListener("scroll", handler);
}, [doc, recordHeading]);

// 面包屑路径
const breadcrumbPath = doc && liveActiveId ? buildPath(doc.headings, liveActiveId) : [];
```

在 Reader 之前渲染面包屑:
```tsx
<Breadcrumb path={breadcrumbPath} />
```

Sidebar 的 activeId 改用 liveActiveId:
```tsx
<Sidebar
  headings={doc?.headings ?? []}
  activeId={liveActiveId}
  onJump={handleJump}
/>
```

- [ ] **Step 3: styles.css 加面包屑样式**

```css
.breadcrumb {
  padding: 6px 48px;
  font-size: 12px;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.breadcrumb-sep { margin: 0 4px; opacity: 0.6; }
```

- [ ] **Step 4: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 5: Commit**

```bash
git add src/components/Breadcrumb.tsx src/App.tsx src/styles.css
git commit -m "feat(phase2): breadcrumb + live outline highlight on scroll"
```

---

## Task 8: recent.rs — 最近打开持久化(TDD)

**Files:**
- Create: `src-tauri/src/recent.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写 recent.rs(含测试)**

Create `src-tauri/src/recent.rs`:
```rust
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
pub fn add(dir: &Path, path: String, name: String, timestamp: i64) -> Result<Vec<RecentEntry>, String> {
    let mut list = load(dir);
    list.retain(|e| e.path != path);
    list.insert(0, RecentEntry { path, name, opened_at: timestamp });
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
        d.push(format!("mdreader-recent-test-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
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
        assert_eq!(list[0].path, "/a.md");  // 移到最前
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
        assert_eq!(list[0].path, "/14.md");  // 最新在前
    }

    #[test]
    fn corrupted_json_returns_empty() {
        let dir = temp_dir();
        fs::write(recent_file_path(&dir), "bad").unwrap();
        assert!(load(&dir).is_empty());
    }
}
```

- [ ] **Step 2: lib.rs 加 recent 模块 + 命令**

在 `mod progress;` 后加 `mod recent;`,在 invoke_handler 之前加命令:
```rust
mod recent;

// 在 read_file 等命令之后加:
#[tauri::command]
fn load_recent(app: AppHandle) -> Result<Vec<recent::RecentEntry>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(recent::load(&data_dir))
}

#[tauri::command]
fn add_recent(app: AppHandle, path: String, name: String) -> Result<Vec<recent::RecentEntry>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let timestamp = chrono::Utc::now().timestamp();
    recent::add(&data_dir, path, name, timestamp)
}
```
在 invoke_handler 加 `load_recent, add_recent`。

- [ ] **Step 3: 运行测试**

Run:
```bash
cd src-tauri && cargo test recent
```
Expected: PASS — 5 个测试

- [ ] **Step 4: Commit**

```bash
cd /Users/apple/ZCodeProject
git add src-tauri/src/recent.rs src-tauri/src/lib.rs
git commit -m "feat(phase2): recent files persistence with tests"
```

---

## Task 9: bookmarks.rs — 书签持久化(TDD)

**Files:**
- Create: `src-tauri/src/bookmarks.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写 bookmarks.rs(含测试)**

Create `src-tauri/src/bookmarks.rs`:
```rust
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

/// 返回某文件的所有书签
pub fn list_for_file(dir: &Path, file_path: &str) -> Vec<Bookmark> {
    load(dir).into_iter().filter(|b| b.file_path == file_path).collect()
}

/// 添加书签(去重:同文件同标题只存一个)
pub fn add(dir: &Path, bookmark: Bookmark) -> Result<Vec<Bookmark>, String> {
    let mut list = load(dir);
    let exists = list.iter().any(|b| b.file_path == bookmark.file_path && b.heading_id == bookmark.heading_id);
    if !exists {
        list.push(bookmark);
        let json = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        fs::write(bookmarks_file_path(dir), json).map_err(|e| e.to_string())?;
    }
    Ok(list)
}

/// 删除书签
pub fn remove(dir: &Path, file_path: &str, heading_id: &str) -> Result<Vec<Bookmark>, String> {
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
        d.push(format!("mdreader-bm-test-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
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
        add(&dir, Bookmark { file_path: "/a.md".into(), heading_id: "h1".into(), heading_text: "H1".into() }).unwrap();
        let list = load(&dir);
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn add_dedupes_same_file_and_heading() {
        let dir = temp_dir();
        let bm = Bookmark { file_path: "/a.md".into(), heading_id: "h1".into(), heading_text: "H1".into() };
        add(&dir, bm.clone()).unwrap();
        add(&dir, bm).unwrap();
        assert_eq!(load(&dir).len(), 1);
    }

    #[test]
    fn remove_works() {
        let dir = temp_dir();
        add(&dir, Bookmark { file_path: "/a.md".into(), heading_id: "h1".into(), heading_text: "H1".into() }).unwrap();
        remove(&dir, "/a.md", "h1").unwrap();
        assert!(load(&dir).is_empty());
    }

    #[test]
    fn list_for_file_filters() {
        let dir = temp_dir();
        add(&dir, Bookmark { file_path: "/a.md".into(), heading_id: "h1".into(), heading_text: "H1".into() }).unwrap();
        add(&dir, Bookmark { file_path: "/b.md".into(), heading_id: "h2".into(), heading_text: "H2".into() }).unwrap();
        assert_eq!(list_for_file(&dir, "/a.md").len(), 1);
    }
}
```

- [ ] **Step 2: lib.rs 加 bookmarks 模块 + 命令**

加 `mod bookmarks;` 和命令:
```rust
mod bookmarks;

#[tauri::command]
fn load_bookmarks(app: AppHandle) -> Result<Vec<bookmarks::Bookmark>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(bookmarks::load(&data_dir))
}

#[tauri::command]
fn add_bookmark(app: AppHandle, file_path: String, heading_id: String, heading_text: String) -> Result<Vec<bookmarks::Bookmark>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    bookmarks::add(&data_dir, bookmarks::Bookmark { file_path, heading_id, heading_text })
}

#[tauri::command]
fn remove_bookmark(app: AppHandle, file_path: String, heading_id: String) -> Result<Vec<bookmarks::Bookmark>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    bookmarks::remove(&data_dir, &file_path, &heading_id)
}
```
invoke_handler 加 `load_bookmarks, add_bookmark, remove_bookmark`。

- [ ] **Step 3: 运行测试**

Run:
```bash
cd src-tauri && cargo test bookmarks
```
Expected: PASS — 5 个测试

- [ ] **Step 4: Commit**

```bash
cd /Users/apple/ZCodeProject
git add src-tauri/src/bookmarks.rs src-tauri/src/lib.rs
git commit -m "feat(phase2): bookmarks persistence with tests"
```

---

## Task 10: tauri-bridge 扩展 + RecentList/Bookmarks 组件 + App 集成

**Files:**
- Modify: `src/lib/tauri-bridge.ts`
- Create: `src/components/RecentList.tsx`, `src/components/Bookmarks.tsx`
- Modify: `src/components/Sidebar.tsx`, `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: tauri-bridge.ts 加 recent/bookmark 接口**

在 `src/lib/tauri-bridge.ts` 末尾追加:
```ts
export interface RecentEntry {
  path: string;
  name: string;
  openedAt: number;
}

export async function loadRecent(): Promise<RecentEntry[]> {
  return invoke<RecentEntry[]>("load_recent");
}

export async function addRecent(path: string, name: string): Promise<void> {
  await invoke("add_recent", { path, name });
}

export interface Bookmark {
  filePath: string;
  headingId: string;
  headingText: string;
}

export async function loadBookmarks(): Promise<Bookmark[]> {
  return invoke<Bookmark[]>("load_bookmarks");
}

export async function addBookmark(
  filePath: string,
  headingId: string,
  headingText: string,
): Promise<void> {
  await invoke("add_bookmark", { filePath, headingId, headingText });
}

export async function removeBookmark(
  filePath: string,
  headingId: string,
): Promise<void> {
  await invoke("remove_bookmark", { filePath, headingId });
}
```

- [ ] **Step 2: RecentList.tsx**

Create `src/components/RecentList.tsx`:
```tsx
import type { RecentEntry } from "../lib/tauri-bridge";

interface RecentListProps {
  entries: RecentEntry[];
  onOpen: (path: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

export function RecentList({ entries, onOpen }: RecentListProps) {
  if (entries.length === 0) {
    return (
      <div className="recent-empty">
        <p>还没有打开过文件</p>
      </div>
    );
  }
  return (
    <div className="recent-list">
      <h3 className="recent-title">最近打开</h3>
      {entries.map((e) => (
        <button
          key={e.path}
          className="recent-item"
          onClick={() => onOpen(e.path)}
        >
          <span className="recent-name">📄 {e.name}</span>
          <span className="recent-time">{timeAgo(e.openedAt)}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Bookmarks.tsx**

Create `src/components/Bookmarks.tsx`:
```tsx
import type { Bookmark } from "../lib/tauri-bridge";

interface BookmarksProps {
  bookmarks: Bookmark[];
  currentFilePath: string | null;
  onJump: (headingId: string) => void;
}

export function Bookmarks({ bookmarks, currentFilePath, onJump }: BookmarksProps) {
  // 只显示当前文件的书签
  const fileBookmarks = bookmarks.filter(
    (b) => b.filePath === currentFilePath,
  );
  if (fileBookmarks.length === 0) return null;
  return (
    <div className="bookmarks-section">
      <h4 className="bookmarks-title">📑 书签</h4>
      {fileBookmarks.map((b) => (
        <button
          key={b.headingId}
          className="bookmark-item"
          onClick={() => onJump(b.headingId)}
        >
          {b.headingText}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Sidebar.tsx 加书签分区 + 书签标记**

在 Sidebar 中引入 Bookmarks 并在顶部渲染,大纲项加书签切换:
```tsx
import type { Heading } from "../lib/markdown";
import type { Bookmark } from "../lib/tauri-bridge";
import { Bookmarks } from "./Bookmarks";

interface SidebarProps {
  headings: Heading[];
  activeId: string | null;
  onJump: (id: string) => void;
  bookmarks: Bookmark[];
  currentFilePath: string | null;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (heading: Heading) => void;
}

export function Sidebar({
  headings, activeId, onJump, bookmarks, currentFilePath, bookmarkedIds, onToggleBookmark
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <Bookmarks
        bookmarks={bookmarks}
        currentFilePath={currentFilePath}
        onJump={onJump}
      />
      {headings.length === 0 ? (
        <p className="sidebar-empty">无大纲</p>
      ) : (
        <nav className="outline">
          {headings.map((h) => (
            <div key={h.id} className={`outline-row level-${h.level}`}>
              <a
                className={`outline-item${h.id === activeId ? " active" : ""}`}
                onClick={() => onJump(h.id)}
              >
                {h.text}
              </a>
              <button
                className={`bookmark-toggle${bookmarkedIds.has(h.id) ? " active" : ""}`}
                onClick={() => onToggleBookmark(h)}
                title="书签"
              >
                {bookmarkedIds.has(h.id) ? "📑" : "🔖"}
              </button>
            </div>
          ))}
        </nav>
      )}
    </aside>
  );
}
```

- [ ] **Step 5: App.tsx 集成 recent + bookmarks**

在 App 中加状态和逻辑:
```tsx
import {
  loadRecent, addRecent, loadBookmarks, addBookmark, removeBookmark,
  type RecentEntry, type Bookmark,
} from "./lib/tauri-bridge";
import { RecentList } from "./components/RecentList";

// 状态
const [recent, setRecent] = useState<RecentEntry[]>([]);
const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

// 启动时加载
useEffect(() => {
  loadRecent().then(setRecent).catch(() => {});
  loadBookmarks().then(setBookmarks).catch(() => {});
}, []);

// openFile 中加 addRecent
const openFile = useCallback(async (path: string) => {
  try {
    const text = await readFile(path);
    const { html, headings } = parse(text);
    setError(null);
    setDoc({ path, html, headings, text });
    const name = path.split("/").pop() || path;
    addRecent(path, name).then(setRecent).catch(() => {});
  } catch (e) {
    setError(String(e));
    setDoc(null);
  }
}, []);

// 书签切换
const bookmarkedIds = new Set(
  bookmarks.filter((b) => b.filePath === doc?.path).map((b) => b.headingId),
);

const handleToggleBookmark = useCallback(
  (heading: Heading) => {
    if (!doc) return;
    if (bookmarkedIds.has(heading.id)) {
      removeBookmark(doc.path, heading.id)
        .then(setBookmarks)
        .catch(() => {});
    } else {
      addBookmark(doc.path, heading.id, heading.text)
        .then(setBookmarks)
        .catch(() => {});
    }
  },
  [doc, bookmarkedIds],
);
```

Reader 区域空状态时显示 RecentList:
```tsx
{doc ? (
  <Reader ref={readerRef} html={doc.html} error={error} />
) : (
  <main className="reader">
    <RecentList entries={recent} onOpen={openFile} />
  </main>
)}
```
Sidebar props 补全 bookmarks/currentFilePath/bookmarkedIds/onToggleBookmark。

- [ ] **Step 6: styles.css 加 recent/bookmarks/bookmark-toggle 样式**

```css
.recent-list { max-width: 500px; margin: 10vh auto; padding: 0 20px; }
.recent-title { color: var(--muted); margin-bottom: 12px; font-size: 14px; }
.recent-item {
  display: flex; justify-content: space-between; width: 100%;
  padding: 10px 14px; margin-bottom: 4px; cursor: pointer;
  background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 6px;
  color: var(--fg);
}
.recent-item:hover { border-color: var(--link); }
.recent-time { color: var(--muted); font-size: 12px; }
.recent-empty { text-align: center; color: var(--muted); margin-top: 30vh; }

.bookmarks-section { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.bookmarks-title { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.bookmark-item {
  display: block; width: 100%; text-align: left; padding: 4px 8px;
  cursor: pointer; background: none; border: none; color: var(--fg); font-size: 13px;
}
.bookmark-item:hover { color: var(--link); }

.outline-row { display: flex; align-items: center; justify-content: space-between; }
.outline-row .outline-item { flex: 1; }
.bookmark-toggle {
  background: none; border: none; cursor: pointer; opacity: 0.4; font-size: 12px;
}
.bookmark-toggle:hover, .bookmark-toggle.active { opacity: 1; }
```

- [ ] **Step 7: 编译验证**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(phase2): recent list + bookmarks UI integration"
```

---

## Task 11: 导出 HTML(TDD)

**Files:**
- Create: `src/lib/export.ts`, `src/lib/__tests__/export.test.ts`
- Modify: `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: 写失败测试**

Create `src/lib/__tests__/export.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildExportHtml } from "../export";

describe("buildExportHtml", () => {
  it("生成完整 HTML 文档,含内联 CSS 和内容", () => {
    const result = buildExportHtml("<h1>标题</h1><p>正文</p>", "测试.md");
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<title>测试.md</title>");
    expect(result).toContain("<h1>标题</h1>");
    expect(result).toContain("<style>");
  });

  it("空内容也能生成", () => {
    const result = buildExportHtml("", "empty.md");
    expect(result).toContain("<!DOCTYPE html>");
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npx vitest run src/lib/__tests__/export.test.ts`
Expected: FAIL — `Cannot find module '../export'`

- [ ] **Step 3: 实现 export.ts**

Create `src/lib/export.ts`:
```ts
export function buildExportHtml(bodyHtml: string, filename: string): string {
  const css = `
    body { font-family: -apple-system, sans-serif; line-height: 1.7; color: #222; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
    code { font-family: "SF Mono", Menlo, monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 6px 12px; }
    th { background: #f6f8fa; }
    img { max-width: 100%; border-radius: 6px; }
    blockquote { border-left: 3px solid #0066cc; padding: 8px 16px; margin: 0; color: #666; font-style: italic; }
  `;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${filename}</title>
<style>${css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npx vitest run src/lib/__tests__/export.test.ts`
Expected: PASS — 2 个测试

- [ ] **Step 5: App.tsx 加导出按钮 + 逻辑**

需要 Rust 端写文件。先在 lib.rs 加一个 `write_text_file` 命令:
```rust
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("写入失败: {}", e))
}
```
invoke_handler 加 `write_text_file`。

tauri-bridge.ts 加:
```ts
export async function writeTextFile(path: string, content: string): Promise<void> {
  await invoke("write_text_file", { path, content });
}
```

App.tsx 加导出逻辑(用 dialog 的 save 选位置):
```tsx
import { save } from "@tauri-apps/plugin-dialog";
import { buildExportHtml } from "./lib/export";
import { writeTextFile } from "./lib/tauri-bridge";

const handleExport = useCallback(async () => {
  if (!doc) return;
  const savePath = await save({
    defaultPath: doc.path.replace(/\.md$/, "") + ".html",
    filters: [{ name: "HTML", extensions: ["html"] }],
  });
  if (!savePath) return;
  const html = buildExportHtml(doc.html, doc.path.split("/").pop() || "export");
  try {
    await writeTextFile(savePath, html);
  } catch (e) {
    setError("导出失败: " + String(e));
  }
}, [doc]);
```
工具栏加按钮:`<button onClick={handleExport}>导出</button>`

- [ ] **Step 6: 编译验证 + Rust 编译**

Run:
```bash
npx tsc --noEmit
cd src-tauri && cargo build
```
Expected: 均零错误

- [ ] **Step 7: Commit**

```bash
cd /Users/apple/ZCodeProject
git add -A
git commit -m "feat(phase2): export to HTML"
```

---

## Task 12: 全量测试 + 手动验收

**Files:** 无(验证)

- [ ] **Step 1: 跑全部前端测试**

Run: `npx vitest run`
Expected: 全部通过(theme 5 + outline 5 + export 2 + markdown 5 + search 11 = 28)

- [ ] **Step 2: 跑全部 Rust 测试**

Run:
```bash
cd src-tauri && cargo test
```
Expected: progress 5 + recent 5 + bookmarks 5 = 15 通过

- [ ] **Step 3: 启动应用验收**

Run:
```bash
cd /Users/apple/ZCodeProject && npm run tauri dev
```

逐条过验收清单:
- [ ] 夜间模式切换正常,代码配色随之变化
- [ ] 字号/行距调节生效且记住
- [ ] 表格/图片/引用块样式正常
- [ ] 点外链在浏览器打开
- [ ] 滚动时大纲高亮跟随
- [ ] 面包屑随滚动显示正确路径
- [ ] 最近列表显示,点击打开
- [ ] 书签添加/删除/跳转正常
- [ ] 导出 HTML 能在浏览器正常打开

- [ ] **Step 4: 修复发现的问题并提交**

```bash
git add -A
git commit -m "fix(phase2): address QA findings"
```

- [ ] **Step 5: 重新打包 DMG**

Run:
```bash
npm run tauri build
```
复制新 DMG 到桌面。

---

## Self-Review 记录

**1. Spec coverage(对照 Phase 2 spec 逐项):**
- 夜间模式 → Task 1(theme.ts) + Task 3(App 集成)✅
- 代码配色 → Task 2(code-themes.css)✅
- 字号/行距 → Task 3(App 状态 + 工具栏)✅
- 表格/图片/引用 → Task 4(styles.css)✅
- 外链 → Task 5(Reader 点击代理 + opener)✅
- 大纲滚动联动 → Task 7(liveActiveId)✅
- 面包屑 → Task 6(outline.ts) + Task 7(Breadcrumb)✅
- 最近列表 → Task 8(recent.rs) + Task 10(RecentList)✅
- 书签 → Task 9(bookmarks.rs) + Task 10(Bookmarks + Sidebar)✅
- 导出 HTML → Task 11(export.ts + write_text_file)✅

**2. Placeholder scan:** 无 TBD/TODO,所有步骤含完整代码 ✅

**3. Type consistency:**
- `Heading { id, level, text }` — outline.ts import 复用 markdown.ts 定义 ✅
- `RecentEntry { path, name, openedAt }` — Rust `opened_at` ↔ TS `openedAt`,Tauri 自动 camelCase ✅
- `Bookmark { filePath, headingId, headingText }` — Rust `file_path` ↔ TS `filePath` ✅
- `buildPath(headings, id) → string[]` — outline.ts 定义,App.tsx 使用一致 ✅
- `buildExportHtml(bodyHtml, filename) → string` — export.ts 定义,App.tsx 使用一致 ✅

**4. 注意点:**
- Task 5 装回前端 opener 包,与已装的 Rust opener 插件配套 ✅
- Task 11 新增 write_text_file 命令,需在 invoke_handler 注册(已在步骤中说明)✅
- Task 7 的 liveActiveId 与 useProgress 的 activeId 是两套:liveActiveId 即时给 UI,useProgress 内部防抖给存储,不冲突 ✅
