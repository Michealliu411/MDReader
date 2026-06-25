import { forwardRef } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface ReaderProps {
  html: string;
  error: string | null;
}

export const Reader = forwardRef<HTMLElement, ReaderProps>(
  ({ html, error }, ref) => {
    // 点击事件代理:点到 <a> 时用系统浏览器打开,不拦截 WebView 导航
    const handleClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor && anchor.href) {
        e.preventDefault();
        openUrl(anchor.href).catch(() => {
          // 静默失败:无法打开链接时不打断阅读
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
        // html 来自本地 markdown-it 解析,非用户输入的外部内容
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);

Reader.displayName = "Reader";
