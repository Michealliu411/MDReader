import { useState, useEffect, useRef } from "react";

interface UrlDialogProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export function UrlDialog({ visible, onClose, onSubmit }: UrlDialogProps) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setUrl("");
      inputRef.current?.focus();
    }
  }, [visible]);

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
      onClose();
    }
  };

  return (
    <div className="url-dialog-overlay" onClick={onClose}>
      <form
        className="url-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>打开网络文档</h3>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/user/repo/blob/main/README.md"
        />
        <div className="url-dialog-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="submit">打开</button>
        </div>
      </form>
    </div>
  );
}
