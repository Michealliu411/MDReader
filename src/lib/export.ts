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
