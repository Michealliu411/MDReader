import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

export interface Heading {
  id: string;
  level: number;
  text: string;
}

export interface ParseResult {
  html: string;
  headings: Heading[];
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${
          hljs.highlight(str, { language: lang }).value
        }</code></pre>`;
      } catch {
        // fall through to default escape
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

export function parse(source: string): ParseResult {
  if (!source) {
    return { html: "", headings: [] };
  }

  const tokens = md.parse(source, {});
  const headings: Heading[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "heading_open") {
      const level = parseInt(token.tag.slice(1), 10);
      if (level >= 1 && level <= 4) {
        // 下一个 inline token 包含标题文本
        const inlineToken = tokens[i + 1];
        const text = inlineToken?.content ?? "";
        headings.push({ id: text, level, text });
      }
    }
  }

  const html = md.render(source);
  return { html, headings };
}
