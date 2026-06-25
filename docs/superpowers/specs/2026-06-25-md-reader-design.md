# MD 阅读器(MD Reader)设计文档

- **日期**: 2026-06-25
- **状态**: 设计已确认,待写实现计划
- **作者**: 用户 + ZCode(经 superpowers brainstorming 流程)

## 1. 概述

一个 **macOS 桌面应用**,用于阅读本地 Markdown 文档,主用场景是阅读 spec 文档。核心诉求是**清晰的分段呈现**——标题层级分明、段落间距舒服,而非花哨的渲染效果或知识管理功能。

### 定位

- **轻量化优先**: 安装包小、内存占用低、启动快
- **通用阅读器**: 不绑定特定内容类型,能打开任意 `.md` 渲染得清楚即可
- **不做的事(YAGNI)**: 双链/标签/知识库(那是 Obsidian 的活)、PDF 导出、多标签页、云同步、插件系统、字号调节、最近列表

### 技术选型

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 形态 | 桌面应用 | 独立窗口、离线、可记进度 |
| 框架 | **Tauri** | 包 ~5MB、内存低,符合轻量化;macOS 一等支持 |
| 前端 | React + TypeScript | 生态成熟,组件化清晰 |
| Markdown 解析 | markdown-it(前端) | 快、可配置,把 Rust 职责压到最小 |

## 2. MVP 功能范围

| # | 功能 | 说明 |
|---|------|------|
| 1 | 打开本地 .md 文件 | 菜单/拖拽打开单个文件 |
| 2 | 大纲导航(侧边栏) | 自动从 H1-H4 生成目录,点击跳转 |
| 3 | 清爽排版渲染 | 标题层级清晰、段落间距舒服、代码块等宽。默认主题即好看 |
| 4 | 阅读进度记忆 | 记住上次读到哪个标题,重开自动定位 |
| 5 | 当前文件内搜索 | Ctrl+F 搜索并高亮,上下跳转 |

**明确不做(第一版)**: 字号/行距调节、最近打开列表、多标签页、双链、云同步、导出。

## 3. 架构

```
┌─────────────────────────────────────────────┐
│              Tauri 主进程 (Rust)              │
│  · 读取本地 .md 文件                          │
│  · 读写进度文件(存上次读到的标题/位置)        │
│  · 应用菜单(打开文件、退出等)                 │
└──────────────────┬──────────────────────────┘
                   │ Tauri IPC (invoke / event)
┌──────────────────┴──────────────────────────┐
│              前端 WebView (TS + React)        │
│                                              │
│  ┌──────────┐  ┌────────────────────────┐   │
│  │ 侧边栏    │  │     阅读区              │   │
│  │ 大纲导航  │  │  Markdown → HTML 渲染   │   │
│  │ (H1-H4)  │  │  · 清爽排版             │   │
│  │          │  │  · 代码块高亮           │   │
│  └──────────┘  │  · 搜索栏(Ctrl+F)      │   │
│                └────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 关键架构决策

1. **Markdown 解析放在前端**。用 `markdown-it`,把 Rust 那层职责压到最小——只管"读文件、存进度"这种系统操作。Rust 代码量极小,降低维护负担。

2. **前后端通过 Tauri `invoke` 通信**:前端调 `read_file(path)` → Rust 读磁盘返回内容;前端调 `save_progress(path, heading)` → Rust 写本地 JSON。

3. **单窗口、单文档**(MVP 不做多标签)。一个窗口读一个文件,简单清爽。

## 4. 模块拆分

遵循单一职责、接口清晰、可独立理解与测试的原则。

```
前端 (src/)
├── lib/
│   ├── markdown.ts      ← Markdown 解析:md 文本 → { html, headings[] }
│   ├── tauri-bridge.ts  ← 封装 invoke 调用:readFile / saveProgress / loadProgress
│   └── search.ts        ← 文件内搜索:在渲染区高亮关键词、跳转上下个匹配
│
├── components/
│   ├── Sidebar.tsx      ← 大纲导航:接收 headings[],渲染可点击列表,点击触发滚动
│   ├── Reader.tsx       ← 阅读区:接收 html,渲染正文,承载搜索高亮
│   ├── SearchBar.tsx    ← 搜索栏:Ctrl+F 唤出,输入框 + 上/下个匹配按钮
│   └── App.tsx          ← 顶层:协调状态(当前文件、大纲、进度)
│
└── hooks/
    └── useProgress.ts   ← 进度读写:打开文件时 loadProgress,滚动停顿时 saveProgress

后端 (src-tauri/)
└── main.rs              ← Tauri 命令定义:read_file / save_progress / load_progress
                          进度文件存到 app_data_dir/progress.json
```

### 模块职责

| 模块 | 做什么 | 接口 | 依赖 |
|------|--------|------|------|
| `markdown.ts` | md → html + 标题树 | `parse(md): {html, headings}` | markdown-it |
| `tauri-bridge.ts` | 屏蔽 IPC 细节 | `readFile(p)`, `saveProgress(p,h)`, `loadProgress(p)` | @tauri-apps/api |
| `search.ts` | 关键词高亮+导航 | `search(text): matches[]`, `next()/prev()` | DOM |
| `Sidebar` | 显示大纲、点击跳转 | props: `headings`, `onJump(id)` | — |
| `Reader` | 渲染正文 | props: `html` | — |
| `SearchBar` | 搜索交互 | props: `onSearch`, `onNext`, `onPrev` | search.ts |
| `App` | 状态中枢 | — | 全部 |
| `main.rs` | 文件 IO + 进度持久化 | Tauri `#[command]` | tauri crate |

功能到模块一一映射:打开=tauri-bridge、大纲=Sidebar、排版=markdown+Reader、搜索=search+SearchBar、进度=useProgress。

## 5. 数据流

打开一个 spec 文档时的完整链路:

1. **用户拖入 spec.md**(或菜单"打开")→ App.tsx 拿到文件路径
2. **App 调用 `tauri-bridge.readFile(path)`** → Tauri IPC → `main.rs read_file()` 读磁盘 → 返回 md 原始文本
3. **App 调用 `markdown.parse(text)`** → markdown-it 解析 → 返回 `{ html, headings[] }`
4. **App 并行触发两件事**:Sidebar 接收 `headings[]` 渲染大纲;Reader 接收 `html` 渲染正文
5. **恢复进度**(与 3、4 并行):`useProgress.loadProgress(path)` → `main.rs` 读 `app_data_dir/progress.json` → 返回上次读到的 heading id → Reader 滚动到该标题
6. **用户阅读、滚动**:停顿 1.5s 后,`useProgress` 记录当前可见标题 → `saveProgress(path, headingId)` → `main.rs` 写 JSON
7. **用户按 Ctrl+F 搜索**:SearchBar 弹出 → `search.ts` 在 Reader DOM 里找匹配 → 高亮 + 上下跳转,不经过 Rust

### 关键点

- Rust 只参与步骤 2、5、6(读文件、读写进度),其余全在前端完成
- 搜索完全在前端操作 DOM,不碰 Rust,响应快
- 进度保存是防抖的(滚动停顿 1.5s 才存),避免频繁写盘
- 大纲和正文并行渲染,打开文件无阻塞感
- 进度定位粒度为**标题级**(H1-H4),不是像素级——对 spec 文档够用,实现简单可靠

## 6. 错误处理

| 出错场景 | 触发原因 | 处理方式 | 用户看到什么 |
|---------|---------|---------|------------|
| 文件读取失败 | 文件被删/移动/无权限 | `read_file` 返回 `Result::Err` | 阅读区显示"无法打开文件:xxx",不崩溃 |
| 文件不是合法 md / 编码异常 | 二进制文件、非 UTF-8 | 解析前做 UTF-8 检测,失败则提示 | "文件编码不支持,请转为 UTF-8" |
| 文件为空 | 新建空文件 | 正常渲染,阅读区显示空 + 引导文字 | "打开一个 Markdown 文件开始阅读" |
| md 解析失败 | markdown-it 抛异常(极少见) | try/catch 包裹 parse | "文档解析失败",显示原始文本作降级 |
| 进度文件损坏/丢失 | JSON 被改坏、首次使用 | `load_progress` 返回 None,不报错 | 静默跳过,从头开始读 |
| 进度写入失败 | 磁盘满/权限 | `save_progress` 静默失败,不影响阅读 | 用户无感(进度没存上而已) |
| 超大文件 | 上百 MB 的 md | 解析+渲染在前端,可能卡顿 | MVP 不特殊处理,记录为已知限制 |

### 三个原则

1. **读操作失败要明确提示**(文件读不到用户得知道为什么)
2. **写操作失败要静默**(进度没存上不该打断阅读)
3. **解析层永远有降级**:md 解析挂了就显示纯文本,不白屏

## 7. 测试策略

分两层:纯函数单元测试(快、多)+ Rust 命令测试(覆盖 IO)。前端组件交互靠手动验收。

| 模块 | 测试方式 | 覆盖什么 |
|------|---------|---------|
| `markdown.ts` | 单元测试(Vitest) | 标题树提取正确(H1-H4 层级)、代码块/列表/链接正常渲染、空文件/纯文本不报错 |
| `search.ts` | 单元测试(Vitest) | 多个匹配正确定位、大小写敏感开关、无匹配时返回空、next/prev 循环跳转 |
| `tauri-bridge.ts` | 手动验收 | invoke 调用对接(依赖 Tauri 运行时,单测 mock 价值低) |
| `main.rs` | Rust 单元测试 | `read_file` 读正常文件、读不存在文件返回 Err、`progress` JSON 读写一致 |
| App/Sidebar/Reader/SearchBar | 手动验收清单 | 见下方 |

### 手动验收清单

- [ ] 拖入 .md 能正确显示
- [ ] 大纲点击能跳到对应标题
- [ ] 关闭重开,定位到上次标题
- [ ] Ctrl+F 搜索,高亮+上下跳转正常
- [ ] 打开不存在的文件,显示错误提示不崩溃
- [ ] 打开空文件,显示引导文字

### 取舍说明

MVP 阶段不为 React 组件上 Testing Library 做组件测试——组件逻辑简单(主要是 props 传递和渲染),手动验收清单覆盖更实在,自动化 ROI 不高。等组件逻辑变复杂了再加。

## 8. 已知限制(MVP)

- 不处理超大文件(上百 MB)的性能问题
- 单窗口单文档,无多标签
- 进度按标题粒度定位,非像素精确
- 不支持字号/行距调节(用合理默认值)
- 仅 macOS(架构可跨平台,但 MVP 不验证其他平台)
