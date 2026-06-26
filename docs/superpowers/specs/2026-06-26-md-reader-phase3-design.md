# MD Reader Phase 3 设计文档

- **日期**: 2026-06-26
- **状态**: 设计已确认,待写实现计划
- **作者**: 用户 + ZCode(经 superpowers brainstorming 流程)
- **前置**: Phase 1(`2026-06-25-md-reader-design.md`)、Phase 2(`2026-06-25-md-reader-phase2-design.md`)

## 1. 概述

在 Phase 1/2 的单文件阅读器基础上,扩展内容来源(本地文件监听 + 文件夹浏览 + 网络 md)并优化工具栏 UI。Phase 3 共 4 项改进。

**不做的事(YAGNI)**: 多标签页、E2E 测试、性能虚拟滚动。

### 范围(4 项)

| 项 | 说明 |
|----|------|
| 文件监听刷新 | notify crate 监听当前文件,变化时自动重读,防抖 500ms,保留滚动位置 |
| 文件夹树形浏览 | 侧边栏变文件树,记住上次文件夹,启动恢复,树本身也监听变化 |
| 读网络 md | 通用 HTTP + GitHub 链接转 raw,磁盘缓存(stale-while-revalidate),离线可用 |
| 工具栏 UI 美化 | 图标按钮(无边框 + emoji + hover 显形),字号显示数值,行距移出工具栏 |

## 2. 文件监听刷新

```
Rust: notify crate 监听当前打开文件路径 → 变化时 emit "file-changed" 事件
前端: 收到事件 → 防抖 500ms → 重新 readFile + parse → 保留 scrollTop 恢复
```

**关键决策:**
- Rust 端用 `notify` crate(成熟、跨平台)
- 打开文件时启动监听,关闭/换文件时停止监听
- 前端防抖 500ms:编辑器一次保存可能触发多个事件,防抖避免重复刷新
- 保留滚动位置:刷新前记录 `scrollTop`,刷新后恢复
- 网络拉取的 md 不监听(无本地文件)

**影响文件:** `Cargo.toml`(加 notify)、新增 `src-tauri/src/watcher.rs`、`lib.rs`(启动/停止监听命令)、`App.tsx`(接收事件 + 防抖重读 + 保留滚动)

## 3. 文件夹树形浏览

```
┌──────────────┬─────────────────────────────┐
│ 📑 书签       │  面包屑                      │
│  数据流       ├─────────────────────────────┤
│ ─────────    │  ## 数据流                    │
│  📂 文件树    │  正文内容...                  │
│  ▾ docs/     │                              │
│    ▾ specs/  │                              │
│      设计.md  │                              │
│    plans/    │                              │
└──────────────┴─────────────────────────────┘
```

**关键决策:**
- 侧边栏从"大纲"切换为"文件树",大纲交给面包屑(Phase 2 已有)
- 书签保留在侧边栏顶部(跨文件快速跳转,与文件树不冲突)
- Rust 端 `list_dir(path)`:递归遍历,返回树结构,只含 `.md`/`.markdown` + 子目录
- 前端 `FileTree.tsx`:递归渲染,文件夹可折叠/展开
- 选定文件夹存 Rust 端 `workspace.json`,下次启动自动恢复
- 点击文件 → 复用现有 `openFile`
- 文件树本身也监听变化:新建/删除文件时树自动刷新

**数据结构:**
```rust
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<TreeNode>,
}
```

**影响文件:** 新增 `src-tauri/src/filetree.rs`、`lib.rs`(加 `list_dir`/`load_workspace`/`save_workspace`)、新增 `src/components/FileTree.tsx`、`App.tsx`(侧边栏替换)、`styles.css`

## 4. 读网络 md

```
用户粘 URL
  ├─ github.com/xxx/blob/xxx.md → 转 raw.githubusercontent.com/xxx/xxx/xxx.md
  ├─ 其他 URL → 直接 GET
  └─ 拉取内容 → 存缓存 → 解析渲染
```

**关键决策:**
- 网络请求放 Rust 端(`reqwest`),不用前端 fetch(WebView 有 CORS 限制)
- 缓存策略 stale-while-revalidate:URL 做 hash 当文件名,先显示缓存秒开,后台拉取最新,有变化才替换
- 缓存有效期 7 天,超过仍可用(离线),但标记"缓存较旧"
- GitHub 转换:`github.com/user/repo/blob/branch/path.md` → `raw.githubusercontent.com/user/repo/branch/path.md`
- 错误处理:网络失败 + 有缓存 → 用缓存 + 顶部提示"离线模式";网络失败 + 无缓存 → "无法加载";URL 无效 → "URL 格式错误"
- 安全:只允许 https,响应大小上限 10MB

**数据结构:**
```rust
pub struct CacheEntry {
    pub url: String,
    pub content: String,
    pub fetched_at: i64,
}
```

**影响文件:** `Cargo.toml`(加 reqwest + sha2)、新增 `src-tauri/src/fetcher.rs`、`lib.rs`(加命令)、新增 `src/components/UrlDialog.tsx`、`App.tsx`(集成)、`tauri-bridge.ts`(加接口)

## 5. 工具栏 UI 美化

```
┌──────────────────────────────────────────────────────────┐
│ 📂  📤  │  A−  16  A+  │  🌐  │  🌙                      │
│ 文件操作  │  字号调节      │ 网络  │  主题                   │
└──────────────────────────────────────────────────────────┘
```

**关键决策:**
- 无边框按钮:默认无边框无底色,hover 时显示 `var(--hover-bg)`
- emoji 图标替代文字:📂 打开文件夹、📤 导出、🌐 网络 URL、🌙/☀️ 主题
- 字号调节组:A− / 当前值数字 / A+,数字实时显示当前字号
- 行距调节从工具栏移除(低频,Phase 2 的 ≡- / ≡+ 移除,行距保持上次值或默认 1.7)

**影响文件:** `App.tsx`(工具栏 JSX 重构)、`styles.css`(按钮样式重写)

## 6. 错误处理(延续 Phase 1/2 原则)

| 场景 | 处理 |
|------|------|
| 文件监听失败(权限/文件消失) | 静默停止监听,不影响阅读 |
| 文件夹遍历失败(无权限) | 提示"无法读取文件夹" |
| 网络拉取失败 + 有缓存 | 用缓存 + 顶部提示"离线模式" |
| 网络拉取失败 + 无缓存 | 提示"无法加载" |
| URL 无效 | 提示"URL 格式错误" |
| 响应超 10MB | 提示"文件过大" |
| 缓存读写失败 | 静默,每次重新拉取 |

原则不变:读失败尽量有提示,写失败静默,解析层有降级。

## 7. 测试策略(延续 Phase 1/2)

| 模块 | 测试方式 |
|------|---------|
| Rust `filetree.rs` | 单元测试(目录遍历、过滤、树构建) |
| Rust `fetcher.rs` | 单元测试(GitHub URL 转换、缓存读写、hash 计算) |
| Rust `watcher.rs` | 手动验收(监听行为依赖文件系统) |
| `FileTree.tsx` | 手动验收 |
| `UrlDialog.tsx` | 手动验收 |
| UI 美化 | 手动验收 |

### 手动验收清单(Phase 3 新增)

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

## 8. 已知限制(Phase 3)

- 文件树不监听子目录外部的变化
- 网络缓存 7 天有效期,不主动清理(手动删 cache 目录)
- 网络请求不显示进度(小文件秒拉,大文件直接限 10MB)
- 行距调节从工具栏移除,只能用默认值或 localStorage 手动改
