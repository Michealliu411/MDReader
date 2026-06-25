import { forwardRef } from "react";

interface ReaderProps {
  html: string;
  error: string | null;
}

export const Reader = forwardRef<HTMLElement, ReaderProps>(
  ({ html, error }, ref) => {
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
        // html 来自本地 markdown-it 解析,非用户输入的外部内容
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);

Reader.displayName = "Reader";
