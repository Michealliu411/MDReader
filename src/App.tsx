import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { parse, type Heading } from "./lib/markdown";
import { readFile } from "./lib/tauri-bridge";
import { findMatches, nextIndex, prevIndex } from "./lib/search";
import {
  getInitialTheme,
  applyTheme,
  toggleTheme,
  saveTheme,
  type Theme,
} from "./lib/theme";
import { Sidebar } from "./components/Sidebar";
import { Reader } from "./components/Reader";
import { SearchBar } from "./components/SearchBar";
import { Breadcrumb } from "./components/Breadcrumb";
import { buildPath } from "./lib/outline";
import { useProgress } from "./hooks/useProgress";
import "./styles.css";

interface LoadedDoc {
  path: string;
  html: string;
  headings: Heading[];
  text: string;
}

function App() {
  // 主题(跟随系统 + 手动切换,存 localStorage)
  const [theme, setTheme] = useState<Theme>(() => {
    const t = getInitialTheme();
    applyTheme(t);
    return t;
  });
  // 字号/行距(存 localStorage)
  const [fontSize, setFontSize] = useState(() =>
    parseInt(localStorage.getItem("md-reader-font-size") || "16", 10),
  );
  const [lineHeight, setLineHeight] = useState(() =>
    parseFloat(localStorage.getItem("md-reader-line-height") || "1.7"),
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
    localStorage.setItem("md-reader-font-size", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--line-height",
      String(lineHeight),
    );
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
  const handleLineInc = () =>
    setLineHeight((l) => Math.min(2.2, +(l + 0.1).toFixed(1)));
  const handleLineDec = () =>
    setLineHeight((l) => Math.max(1.4, +(l - 0.1).toFixed(1)));

  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const readerRef = useRef<HTMLElement>(null);
  // 即时高亮(给面包屑和大纲),独立于 useProgress 的防抖版本
  const [liveActiveId, setLiveActiveId] = useState<string | null>(null);

  const { restoreId, recordHeading } = useProgress(doc?.path ?? null);

  // 面包屑路径:根据 liveActiveId 反查标题树
  const breadcrumbPath =
    doc && liveActiveId ? buildPath(doc.headings, liveActiveId) : [];

  const openFile = useCallback(async (path: string) => {
    try {
      const text = await readFile(path);
      const { html, headings } = parse(text);
      setError(null);
      setDoc({ path, html, headings, text });
    } catch (e) {
      setError(String(e));
      setDoc(null);
    }
  }, []);

  // 菜单"打开" → 调系统文件对话框
  const handleOpen = useCallback(async () => {
    const selected = await open({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (typeof selected === "string") await openFile(selected);
  }, [openFile]);

  // 拖入文件
  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>("tauri://file-drop", (e) => {
      const path = e.payload.paths[0];
      if (path) openFile(path);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openFile]);

  // Cmd/Ctrl+F 搜索,Esc 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchVisible(true);
      }
      if (e.key === "Escape") setSearchVisible(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 搜索匹配(基于原始 md 文本)
  const matches = doc ? findMatches(doc.text, keyword, caseSensitive) : [];

  const handleSearch = useCallback((kw: string, cs: boolean) => {
    setKeyword(kw);
    setCaseSensitive(cs);
    setCurrentMatch(0);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentMatch((c) => nextIndex(matches, c));
  }, [matches]);

  const handlePrev = useCallback(() => {
    setCurrentMatch((c) => prevIndex(matches, c));
  }, [matches]);

  // 滚动监听:记录当前可见标题(防抖由 useProgress 内部处理)
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
        setLiveActiveId(visible.textContent); // 即时,给面包屑和大纲
        recordHeading(visible.textContent); // 防抖,给进度存储
      }
    };
    reader.addEventListener("scroll", handler);
    return () => reader.removeEventListener("scroll", handler);
  }, [doc, recordHeading]);

  // 恢复进度:滚动到上次标题
  useEffect(() => {
    if (restoreId && readerRef.current && doc) {
      const target = Array.from(
        readerRef.current.querySelectorAll("h1, h2, h3, h4"),
      ).find((h) => h.textContent === restoreId);
      target?.scrollIntoView();
    }
  }, [restoreId, doc]);

  const handleJump = useCallback((id: string) => {
    if (!readerRef.current) return;
    const target = Array.from(
      readerRef.current.querySelectorAll("h1, h2, h3, h4"),
    ).find((h) => h.textContent === id);
    target?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={handleOpen}>打开</button>
        <span className="toolbar-sep" />
        <button onClick={handleFontDec}>A-</button>
        <button onClick={handleFontInc}>A+</button>
        <button onClick={handleLineDec}>≡-</button>
        <button onClick={handleLineInc}>≡+</button>
        <span className="toolbar-sep" />
        <button onClick={handleToggleTheme}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
      <SearchBar
        visible={searchVisible}
        onSearch={handleSearch}
        onNext={handleNext}
        onPrev={handlePrev}
        onClose={() => setSearchVisible(false)}
        matchCount={matches.length}
        currentMatch={currentMatch}
      />
      <div className="main">
        <Sidebar
          headings={doc?.headings ?? []}
          activeId={liveActiveId}
          onJump={handleJump}
        />
        <div className="reader-wrap">
          <Breadcrumb path={breadcrumbPath} />
          <Reader ref={readerRef} html={doc?.html ?? ""} error={error} />
        </div>
      </div>
    </div>
  );
}

export default App;
