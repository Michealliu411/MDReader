# MD Reader Phase 2 设计文档

- **日期**: 2026-06-25
- **状态**: 设计已确认,待写实现计划
- **作者**: 用户 + ZCode(经 superpowers brainstorming 流程)
- **前置**: `docs/superpowers/specs/2026-06-25-md-reader-design.md`(Phase 1)

## 1. 概述

在 Phase 1 的单文档阅读器基础上,优化阅读体验并补全常用功能。Phase 2 共 10 项改进,分四组:主题、排版、交互、功能。

**不做的事(YAGNI)**: 多标签页(架构改动过大,留待 Phase 3 单独立项)。

### 范围(10 项)

| 组 | 项 | 说明 |
|----|----|------|
| 主题 | 夜间模式 | 日/夜双主题,跟随系统 + 手动切换,记 localStorage |
| 主题 | 代码块配色 | 日间 github、夜间 github-dark,随主题切换 |
| 排版 | 字号/行距调节 | 工具栏 +/- 调节,范围 12-24px / 1.4-2.2,记 localStorage |
| 排版 | 表格/图片/引用样式 | 补全 markdown 元素排版样式 |
| 交互 | 外链浏览器打开 | 点链接调 opener 插件用系统浏览器打开 |
| 交互 | 大纲滚动联动 | 滚动时大纲实时高亮当前标题 |
| 交互 | 目录面包屑 | Reader 顶部显示当前章节路径,随滚动变化 |
| 功能 | 最近打开列表 | Rust 端 recent.json 持久化,启动/空状态显示 |
| 功能 | 书签 | 大纲项加书签,书签区快速跳转 |
| 功能 | 导出 HTML | 把渲染结果导出为独立 .html 文件 |

## 2. 主题系统(第 1 组)

### 夜间模式

- CSS 变量统一管理颜色,`:root[data-theme="light|dark"]` 两套值
- 启动时读系统主题(`prefers-color-scheme`)作为默认
- 工具栏加切换按钮(☀️/🌙),点击手动切换,覆盖系统
- 选择存 `localStorage`,下次记住

```css
:root[data-theme="light"] {
  --bg: #ffffff;  --fg: #222;  --code-bg: #f6f8fa;  --sidebar-bg: #fafafa;
}
:root[data-theme="dark"] {
  --bg: #1e1e1e;  --fg: #d4d4d4;  --code-bg: #2d2d2d;  --sidebar-bg: #252526;
}
```

### 代码配色

- 日间:highlight.js `github` 主题
- 夜间:highlight.js `github-dark` 主题
- 切换 `data-theme` 时动态加载对应 CSS

**影响文件**: `styles.css`(改用变量)、`App.tsx`(主题状态 + 切换按钮)、新增 `lib/theme.ts`(主题管理)

## 3. 排版增强(第 2 组)

### 字号/行距调节

- 工具栏加 `A-` / `A+` 调字号,`≡` 调行距
- CSS 变量 `--font-size`、`--line-height` 控制
- 范围限制:字号 12-24px,行距 1.4-2.2
- 存 `localStorage`,下次记住

```css
.reader { font-size: var(--font-size, 16px); line-height: var(--line-height, 1.7); }
```

### 表格/图片/引用块样式

| 元素 | 改进 |
|------|------|
| 表格 | 边框 + 表头底色 + 单元格内边距,长表格横向滚动 |
| 图片 | 最大宽度 100%,居中,圆角 |
| 引用块 | 左侧色条 + 浅底色 + 斜体 |

**影响文件**: `styles.css`(变量 + 新元素样式)、`App.tsx`(字号行距按钮 + 状态)

## 4. 交互改进(第 3 组)

### 外链浏览器打开

- Reader 点击事件代理:点到 `<a>` 时调 `tauri-plugin-opener` 用系统浏览器打开
- 装回 opener 插件(已实测:DMG 仅 +0.1MB)
- capabilities 加 `opener:default` 权限(已加)

### 大纲滚动联动

- 复用 Phase 1 的滚动监听,但分两条路径:
  - **即时路径**:滚动时立即算当前标题,更新 Sidebar 的 `activeId`(用于高亮)
  - **防抖路径**:1.5s 防抖后存进度(给 useProgress,不变)
- 两条路径分开,不互相影响

### 目录面包屑

- Reader 顶部显示当前章节路径,如 `设计 › 数据流 › 恢复进度`
- 根据 `activeId` 反查 headings 树,拼出从 H1 到当前的完整层级路径
- 需要算标题父子关系(某 H3 的父是它前面最近的 H2)

```
┌─────────────────────────────────────┐
│ 设计 › 数据流 › 恢复进度            │  ← 面包屑(随滚动变化)
├─────────────────────────────────────┤
│  ## 恢复进度                         │
│  打开文件时,Rust 读取磁盘...        │
└─────────────────────────────────────┘
```

**影响文件**: `App.tsx`(滚动即时 activeId + 面包屑)、新增 `lib/outline.ts`(算标题路径)、新增 `components/Breadcrumb.tsx`、`styles.css`(面包屑样式)

## 5. 新增功能(第 4 组)

### 最近打开列表

- Rust 端新增 `recent.json`,存最近 10 个文件:`[{ path, name, openedAt }]`
- Rust 命令:`load_recent` / `add_recent`(去重、移到最前、截断到 10 个)
- 启动时/无文档时,Reader 区显示最近列表
- 打开文件时自动调 `add_recent`

```
┌─────────────────────────────┐
│  最近打开                    │
│  ─────────────────           │
│  📄 spec.md       刚刚       │
│  📄 design.md     2小时前    │
│  📄 notes.md      昨天       │
└─────────────────────────────┘
```

### 书签

- 大纲项右侧 📑 图标,点击添加/删除书签(不在正文加图标,避免干扰阅读)
- Rust 端 `bookmarks.json`:`[{ filePath, headingId, headingText }]`
- 侧边栏顶部加"书签"分区,点击跳转到对应文件的对应标题
- 打开文件时,该书签对应标题在大纲里显示书签标记

### 导出

- 提供"导出 HTML":把渲染后的 HTML + 内联 CSS 写成 `.html` 文件
- PDF 走系统打印对话框(Cmd+P),不自己实现 PDF 渲染
- MVP 先做 HTML 导出

**影响文件**: 新增 Rust 模块 `recent.rs` + `bookmarks.rs`、`lib.rs`(加命令)、新增前端 `components/RecentList.tsx` + `Bookmarks.tsx`、`App.tsx`(集成)、新增 `lib/export.ts`

## 6. 数据结构定义

### recent.json

```json
[
  { "path": "/Users/apple/spec.md", "name": "spec.md", "openedAt": 1782376315 }
]
```

### bookmarks.json

```json
[
  { "filePath": "/Users/apple/spec.md", "headingId": "数据流", "headingText": "数据流" }
]
```

### 新增前端类型

```ts
// lib/outline.ts
interface HeadingPath {
  headings: string[];  // 从 H1 到当前的完整路径,如 ["设计", "数据流", "恢复进度"]
}

// lib/tauri-bridge.ts 扩展
interface RecentEntry {
  path: string;
  name: string;
  openedAt: number;
}

interface Bookmark {
  filePath: string;
  headingId: string;
  headingText: string;
}
```

## 7. 错误处理(延续 Phase 1 原则)

| 场景 | 处理 |
|------|------|
| recent.json 读写失败 | 静默,最近列表为空 |
| bookmarks.json 读写失败 | 静默,书签为空 |
| 导出 HTML 写盘失败 | 提示"导出失败" |
| opener 打开外链失败 | 提示"无法打开链接" |
| localStorage 不可用 | 用内存默认值,不崩溃 |

原则不变:读失败静默,写失败不打断阅读,解析层有降级。

## 8. 测试策略(延续 Phase 1)

| 模块 | 测试方式 |
|------|---------|
| `lib/theme.ts` | 单元测试(主题切换逻辑) |
| `lib/outline.ts` | 单元测试(标题路径计算) |
| `lib/export.ts` | 单元测试(HTML 拼装) |
| Rust `recent.rs` | 单元测试(增删查、去重、截断) |
| Rust `bookmarks.rs` | 单元测试(增删查) |
| 主题/字号/面包屑等 UI | 手动验收清单 |

### 手动验收清单(Phase 2 新增)

- [ ] 夜间模式切换正常,代码配色随之变化
- [ ] 字号/行距调节生效且记住
- [ ] 表格/图片/引用块样式正常
- [ ] 点外链在浏览器打开
- [ ] 滚动时大纲高亮跟随
- [ ] 面包屑随滚动显示正确路径
- [ ] 最近列表显示,点击打开
- [ ] 书签添加/删除/跳转正常
- [ ] 导出 HTML 能在浏览器正常打开

## 9. 已知限制(Phase 2)

- 仍是单文档(无多标签)
- 导出仅 HTML,PDF 走系统打印
- 书签仅按标题粒度
- 主题/字号偏好存 localStorage(不跨设备同步,自用场景够用)
