# MD Reader

一个 macOS 上的轻量级 Markdown 阅读器。专注于清晰的分段呈现与舒适的阅读体验,主用场景是阅读 spec、文档、技术笔记。

> 安装包仅 **4.4 MB** —— 基于 Tauri 构建,不臃肿、启动快、内存占用低。

## ✨ 功能

### 核心
- 📂 打开本地 `.md` 文件(对话框 / 拖拽)
- 📂 **文件夹树形浏览** —— 打开整个文件夹,侧边栏树形导航,点击切换文档
- 👀 **文件监听自动刷新** —— 外部编辑器改了 md,阅读器自动更新(保留滚动位置)
- 🌐 **读网络文档** —— 粘 URL 拉取(GitHub 链接自动转 raw),磁盘缓存离线可用
- 🎨 清爽排版渲染(标题层级、段落、代码块高亮)
- 💾 阅读进度记忆(按标题粒度,关闭重开自动定位)
- 🔍 文件内搜索(`⌘F`,高亮 + 上下跳转)

### 阅读体验
- 🌙 日间 / 夜间双主题(跟随系统 + 手动切换)
- 🔤 字号调节(12–24px,偏好持久化)
- 🖼️ 表格、图片、引用块、链接完整样式
- 🔗 外链一键在系统浏览器打开
- 🧭 目录面包屑(随滚动显示当前章节路径)

### 功能增强
- 🕘 最近打开列表(启动 / 空状态一键打开)
- 🔖 书签(侧边栏书签区快速跳转)
- 📤 导出 HTML(带内联样式,可独立分享)
- 🗂️ 记住上次打开的文件夹,启动自动恢复

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | [Tauri](https://tauri.app/) v2 |
| 前端 | React 19 + TypeScript + Vite |
| Markdown 解析 | markdown-it + highlight.js |
| 后端 | Rust(notify / reqwest / sha2) |
| 测试 | Vitest(前端)+ `cargo test`(Rust),共 56 个 |

**为什么选 Tauri?** 同样的功能用 Electron 打包至少 80MB+,而 Tauri 利用系统 WebView,安装包只有 4.4MB,内存占用更低。

## 📦 下载安装

1. 下载最新 release 的 `.dmg` 文件
2. 双击挂载,将 **MD Reader** 拖入 Applications
3. 首次打开若提示"无法验证开发者":右键 → 打开,或系统设置 → 隐私与安全性 → 仍要打开

> ⚠️ 当前版本未做 Apple 代码签名,首次打开需要上述手动信任步骤。

详见 [用户说明文档](docs/USER_GUIDE.md)。

## 🔧 本地开发

**前置依赖:** Node.js、[Rust](https://rustup.rs/)、Xcode Command Line Tools

```bash
# 安装依赖
npm install

# 开发模式(热重载)
npm run tauri dev

# 运行测试
npm test                    # 前端 28 个
cd src-tauri && cargo test  # Rust 28 个

# 打包
npm run tauri build
# 产物:src-tauri/target/release/bundle/dmg/MD Reader_x.x.x_aarch64.dmg
```

## 📁 项目结构

```
src/                      # 前端
├── lib/
│   ├── markdown.ts       # md → {html, headings} 解析
│   ├── tauri-bridge.ts   # Tauri invoke 封装
│   ├── search.ts         # 文件内搜索
│   ├── outline.ts        # 标题路径计算(面包屑)
│   ├── export.ts         # 导出 HTML
│   └── theme.ts          # 主题管理
├── components/           # React 组件(Sidebar/FileTree/Reader/SearchBar 等)
├── hooks/
│   └── useProgress.ts    # 阅读进度(防抖读写)
└── styles.css            # CSS 变量驱动的主题样式

src-tauri/src/            # Rust 后端
├── lib.rs                # Tauri 命令入口
├── progress.rs           # 阅读进度持久化
├── recent.rs             # 最近打开列表
├── bookmarks.rs          # 书签持久化
├── watcher.rs            # 文件监听(notify)
├── filetree.rs           # 目录遍历 + workspace 持久化
└── fetcher.rs            # 网络 md 拉取 + GitHub 转换 + 磁盘缓存
```

## 📝 设计文档

详细的架构与设计决策记录在 `docs/superpowers/specs/`:
- Phase 1 设计:`2026-06-25-md-reader-design.md`
- Phase 2 设计:`2026-06-25-md-reader-phase2-design.md`
- Phase 3 设计:`2026-06-26-md-reader-phase3-design.md`

实现计划在 `docs/superpowers/plans/`。

## 📄 License

MIT
